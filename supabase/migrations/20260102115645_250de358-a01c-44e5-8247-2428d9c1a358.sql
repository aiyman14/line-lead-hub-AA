
-- Function to notify supervisors when efficiency drops below target
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
BEGIN
  -- Get line target efficiency
  SELECT target_efficiency, COALESCE(lines.name, lines.line_id) INTO line_target, line_name
  FROM lines WHERE id = NEW.line_id;
  
  -- Get work order target if exists
  IF NEW.work_order_id IS NOT NULL THEN
    SELECT target_per_hour INTO work_order_target FROM work_orders WHERE id = NEW.work_order_id;
  END IF;
  
  -- Use work order target, then line target, default to 85%
  effective_target := COALESCE(work_order_target, line_target, 85);
  
  -- Calculate efficiency based on update type (sewing vs finishing)
  IF TG_TABLE_NAME = 'production_updates_sewing' THEN
    IF COALESCE(NEW.target_qty, 0) > 0 THEN
      calculated_efficiency := (NEW.output_qty::NUMERIC / NEW.target_qty) * 100;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    -- For finishing, use per_hour_target
    IF COALESCE(NEW.per_hour_target, 0) > 0 THEN
      calculated_efficiency := (NEW.qc_pass_qty::NUMERIC / NEW.per_hour_target) * 100;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  -- If efficiency is below target, notify supervisors and admins
  IF calculated_efficiency < effective_target THEN
    FOR supervisor_record IN 
      SELECT p.id as user_id
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.factory_id = NEW.factory_id
      AND ur.role IN ('supervisor', 'admin', 'owner')
    LOOP
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
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to notify supervisors when critical blockers are reported
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
BEGIN
  -- Only trigger on critical blockers
  IF NEW.has_blocker = true AND NEW.blocker_impact = 'critical' THEN
    -- Get line name
    SELECT COALESCE(lines.name, lines.line_id) INTO line_name
    FROM lines WHERE id = NEW.line_id;
    
    -- Get blocker type name if exists
    IF NEW.blocker_type_id IS NOT NULL THEN
      SELECT name INTO blocker_name FROM blocker_types WHERE id = NEW.blocker_type_id;
    ELSE
      blocker_name := 'Unknown';
    END IF;
    
    -- Notify supervisors and admins
    FOR supervisor_record IN 
      SELECT p.id as user_id
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.factory_id = NEW.factory_id
      AND ur.role IN ('supervisor', 'admin', 'owner')
    LOOP
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
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for sewing updates
DROP TRIGGER IF EXISTS trigger_notify_low_efficiency_sewing ON production_updates_sewing;
CREATE TRIGGER trigger_notify_low_efficiency_sewing
  AFTER INSERT ON production_updates_sewing
  FOR EACH ROW
  EXECUTE FUNCTION notify_low_efficiency();

DROP TRIGGER IF EXISTS trigger_notify_critical_blocker_sewing ON production_updates_sewing;
CREATE TRIGGER trigger_notify_critical_blocker_sewing
  AFTER INSERT ON production_updates_sewing
  FOR EACH ROW
  EXECUTE FUNCTION notify_critical_blocker();

-- Create triggers for finishing updates
DROP TRIGGER IF EXISTS trigger_notify_low_efficiency_finishing ON production_updates_finishing;
CREATE TRIGGER trigger_notify_low_efficiency_finishing
  AFTER INSERT ON production_updates_finishing
  FOR EACH ROW
  EXECUTE FUNCTION notify_low_efficiency();

DROP TRIGGER IF EXISTS trigger_notify_critical_blocker_finishing ON production_updates_finishing;
CREATE TRIGGER trigger_notify_critical_blocker_finishing
  AFTER INSERT ON production_updates_finishing
  FOR EACH ROW
  EXECUTE FUNCTION notify_critical_blocker();
