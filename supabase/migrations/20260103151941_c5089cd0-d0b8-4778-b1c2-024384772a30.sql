
-- Fix the format string issue in notify_low_efficiency function
CREATE OR REPLACE FUNCTION public.notify_low_efficiency()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          'Line ' || line_name || ' efficiency dropped to ' || round(calculated_efficiency, 1) || '% (target: ' || effective_target || '%)',
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
$function$;
