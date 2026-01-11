-- Rename supervisor role to admin in the database
-- This migrates existing supervisor users to admin and updates helper functions

-- 1. Migrate existing users with 'supervisor' role to 'admin'
UPDATE public.user_roles 
SET role = 'admin' 
WHERE role = 'supervisor';

-- 2. Update is_admin_or_higher function to remove supervisor check (it's now just admin)
CREATE OR REPLACE FUNCTION public.is_admin_or_higher(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role IN ('admin', 'owner', 'superadmin')
    )
$$;

-- 3. Update is_supervisor_or_higher to be an alias for is_admin_or_higher
-- (keeping for backwards compatibility with existing RLS policies)
CREATE OR REPLACE FUNCTION public.is_supervisor_or_higher(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('admin', 'owner', 'superadmin')
  )
$$;

-- 4. Update notify_low_efficiency to use admin role
CREATE OR REPLACE FUNCTION public.notify_low_efficiency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_efficiency INTEGER;
  effective_target INTEGER;
  calculated_efficiency NUMERIC;
  admin_record RECORD;
  line_name TEXT;
  pref_enabled BOOLEAN;
BEGIN
  IF NEW.output_qty IS NULL OR NEW.target_qty IS NULL OR NEW.target_qty <= 0 THEN
    RETURN NEW;
  END IF;
  
  SELECT COALESCE(l.target_efficiency, 85) INTO target_efficiency
  FROM lines l WHERE l.id = NEW.line_id;
  
  effective_target := COALESCE(target_efficiency, 85);
  calculated_efficiency := (NEW.output_qty::NUMERIC / NEW.target_qty::NUMERIC) * 100;
  
  SELECT COALESCE(l.name, l.line_id) INTO line_name
  FROM lines l WHERE l.id = NEW.line_id;
  
  IF calculated_efficiency < effective_target THEN
    FOR admin_record IN 
      SELECT p.id as user_id
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.factory_id = NEW.factory_id
      AND ur.role IN ('admin', 'owner')
    LOOP
      SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
      FROM notification_preferences
      WHERE user_id = admin_record.user_id AND notification_type = 'low_efficiency';
      
      IF pref_enabled IS NULL OR pref_enabled = true THEN
        INSERT INTO notifications (factory_id, user_id, title, message, type, data)
        VALUES (
          NEW.factory_id,
          admin_record.user_id,
          'Low Efficiency Alert',
          'Line ' || line_name || ' efficiency dropped to ' || round(calculated_efficiency, 1) || '% (target: ' || effective_target || '%)',
          'low_efficiency',
          jsonb_build_object(
            'line_id', NEW.line_id,
            'efficiency', round(calculated_efficiency, 1),
            'target', effective_target,
            'submission_id', NEW.id
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Update notify_critical_blocker to use admin role
CREATE OR REPLACE FUNCTION public.notify_critical_blocker()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
  line_name TEXT;
  blocker_name TEXT;
  pref_enabled BOOLEAN;
BEGIN
  IF NEW.has_blocker = true AND NEW.blocker_impact IN ('critical', 'high') THEN
    SELECT COALESCE(l.name, l.line_id) INTO line_name
    FROM lines l WHERE l.id = NEW.line_id;
    
    SELECT COALESCE(bt.name, 'Unknown') INTO blocker_name
    FROM blocker_types bt WHERE bt.id = NEW.blocker_type_id;
    
    FOR admin_record IN 
      SELECT p.id as user_id
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.factory_id = NEW.factory_id
      AND ur.role IN ('admin', 'owner')
    LOOP
      SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
      FROM notification_preferences
      WHERE user_id = admin_record.user_id AND notification_type = 'critical_blocker';
      
      IF pref_enabled IS NULL OR pref_enabled = true THEN
        INSERT INTO notifications (factory_id, user_id, title, message, type, data)
        VALUES (
          NEW.factory_id,
          admin_record.user_id,
          'Critical Blocker Reported',
          'Line ' || line_name || ': ' || blocker_name || ' (' || NEW.blocker_impact || ' impact)',
          'critical_blocker',
          jsonb_build_object(
            'line_id', NEW.line_id,
            'blocker_type', blocker_name,
            'impact', NEW.blocker_impact,
            'description', NEW.blocker_description,
            'submission_id', NEW.id
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;