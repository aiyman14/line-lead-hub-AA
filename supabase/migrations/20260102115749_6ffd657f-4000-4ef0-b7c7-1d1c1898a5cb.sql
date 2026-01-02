
-- Create notification preferences table
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factory_id UUID NOT NULL REFERENCES factory_accounts(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  in_app_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own preferences"
ON public.notification_preferences FOR SELECT
USING (user_id = auth.uid() OR is_superadmin(auth.uid()));

CREATE POLICY "Users can manage their own preferences"
ON public.notification_preferences FOR ALL
USING (user_id = auth.uid() OR is_superadmin(auth.uid()));

-- Update trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert default preferences for existing users
INSERT INTO notification_preferences (user_id, factory_id, notification_type, in_app_enabled, email_enabled)
SELECT p.id, p.factory_id, nt.type, true, false
FROM profiles p
CROSS JOIN (VALUES ('low_efficiency'), ('critical_blocker'), ('general')) AS nt(type)
WHERE p.factory_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Update notify functions to check preferences
CREATE OR REPLACE FUNCTION public.notify_low_efficiency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line_target INTEGER;
  work_order_target INTEGER;
  effective_target INTEGER;
  calculated_efficiency NUMERIC;
  supervisor_record RECORD;
  line_name TEXT;
  pref_enabled BOOLEAN;
BEGIN
  SELECT target_efficiency, COALESCE(lines.name, lines.line_id) INTO line_target, line_name
  FROM lines WHERE id = NEW.line_id;
  
  IF NEW.work_order_id IS NOT NULL THEN
    SELECT target_per_hour INTO work_order_target FROM work_orders WHERE id = NEW.work_order_id;
  END IF;
  
  effective_target := COALESCE(work_order_target, line_target, 85);
  
  IF TG_TABLE_NAME = 'production_updates_sewing' THEN
    IF COALESCE(NEW.target_qty, 0) > 0 THEN
      calculated_efficiency := (NEW.output_qty::NUMERIC / NEW.target_qty) * 100;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    IF COALESCE(NEW.per_hour_target, 0) > 0 THEN
      calculated_efficiency := (NEW.qc_pass_qty::NUMERIC / NEW.per_hour_target) * 100;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  IF calculated_efficiency < effective_target THEN
    FOR supervisor_record IN 
      SELECT p.id as user_id
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.factory_id = NEW.factory_id
      AND ur.role IN ('supervisor', 'admin', 'owner')
    LOOP
      -- Check if user has in_app notifications enabled for this type
      SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
      FROM notification_preferences
      WHERE user_id = supervisor_record.user_id AND notification_type = 'low_efficiency';
      
      IF pref_enabled IS NULL OR pref_enabled = true THEN
        INSERT INTO notifications (factory_id, user_id, title, message, type, data)
        VALUES (
          NEW.factory_id,
          supervisor_record.user_id,
          'Low Efficiency Alert',
          format('Line %s efficiency dropped to %.1f%% (target: %s%%)', line_name, calculated_efficiency, effective_target),
          'warning',
          jsonb_build_object(
            'line_id', NEW.line_id,
            'efficiency', calculated_efficiency,
            'target', effective_target,
            'production_date', NEW.production_date
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_critical_blocker()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supervisor_record RECORD;
  line_name TEXT;
  blocker_name TEXT;
  pref_enabled BOOLEAN;
BEGIN
  IF NEW.has_blocker = true AND NEW.blocker_impact = 'critical' THEN
    SELECT COALESCE(lines.name, lines.line_id) INTO line_name
    FROM lines WHERE id = NEW.line_id;
    
    IF NEW.blocker_type_id IS NOT NULL THEN
      SELECT name INTO blocker_name FROM blocker_types WHERE id = NEW.blocker_type_id;
    ELSE
      blocker_name := 'Unknown';
    END IF;
    
    FOR supervisor_record IN 
      SELECT p.id as user_id
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.factory_id = NEW.factory_id
      AND ur.role IN ('supervisor', 'admin', 'owner')
    LOOP
      -- Check if user has in_app notifications enabled for this type
      SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
      FROM notification_preferences
      WHERE user_id = supervisor_record.user_id AND notification_type = 'critical_blocker';
      
      IF pref_enabled IS NULL OR pref_enabled = true THEN
        INSERT INTO notifications (factory_id, user_id, title, message, type, data)
        VALUES (
          NEW.factory_id,
          supervisor_record.user_id,
          'Critical Blocker Reported',
          format('Line %s: %s - %s', line_name, blocker_name, COALESCE(NEW.blocker_description, 'No description')),
          'blocker',
          jsonb_build_object(
            'line_id', NEW.line_id,
            'blocker_type_id', NEW.blocker_type_id,
            'blocker_impact', NEW.blocker_impact,
            'production_date', NEW.production_date
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;
