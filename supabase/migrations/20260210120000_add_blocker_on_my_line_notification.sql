-- Add blocker_on_my_line notification trigger
-- Notifies workers/leads assigned to a line when any blocker is reported on their line.
-- Different from critical_blocker which only notifies admin/owner for critical/high impact.

CREATE OR REPLACE FUNCTION public.notify_blocker_on_my_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
  line_name TEXT;
  blocker_name TEXT;
  pref_enabled BOOLEAN;
BEGIN
  -- Only fire when there is a blocker
  IF NEW.has_blocker IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Get line name
  SELECT COALESCE(l.name, l.line_id) INTO line_name
  FROM lines l WHERE l.id = NEW.line_id;

  -- Get blocker type name
  IF NEW.blocker_type_id IS NOT NULL THEN
    SELECT COALESCE(bt.name, 'Unknown') INTO blocker_name
    FROM blocker_types bt WHERE bt.id = NEW.blocker_type_id;
  ELSE
    blocker_name := 'Unknown';
  END IF;

  -- Find users assigned to this line via user_line_assignments OR profiles.assigned_unit_id
  -- Exclude the submitter (no self-notification) and admin/owner (they get critical_blocker)
  FOR user_record IN
    SELECT DISTINCT sub.user_id
    FROM (
      -- Users via user_line_assignments
      SELECT ula.user_id
      FROM user_line_assignments ula
      JOIN profiles p ON p.id = ula.user_id
      WHERE ula.line_id = NEW.line_id
        AND p.factory_id = NEW.factory_id
        AND p.is_active = true
      UNION
      -- Users via profiles.assigned_unit_id
      SELECT p.id AS user_id
      FROM profiles p
      WHERE p.assigned_unit_id = NEW.line_id
        AND p.factory_id = NEW.factory_id
        AND p.is_active = true
    ) sub
    -- Exclude submitter
    WHERE sub.user_id IS DISTINCT FROM NEW.submitted_by
    -- Exclude admin/owner/superadmin (they already get critical_blocker notifications)
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = sub.user_id
        AND ur.role IN ('admin', 'owner', 'superadmin')
    )
  LOOP
    -- Check notification preferences
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = user_record.user_id
      AND notification_type = 'blocker_on_my_line';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        NEW.factory_id,
        user_record.user_id,
        'Blocker on Your Line',
        'Line ' || COALESCE(line_name, 'Unknown') || ': ' || COALESCE(blocker_name, 'Unknown')
          || ' (' || COALESCE(NEW.blocker_impact::text, 'unknown') || ' impact)',
        'blocker_on_my_line',
        jsonb_build_object(
          'line_id', NEW.line_id,
          'line_name', line_name,
          'blocker_type', blocker_name,
          'impact', NEW.blocker_impact,
          'description', NEW.blocker_description,
          'submission_id', NEW.id,
          'table_name', TG_TABLE_NAME
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Attach triggers to all tables with blocker fields
DROP TRIGGER IF EXISTS trigger_notify_blocker_on_my_line ON sewing_actuals;
CREATE TRIGGER trigger_notify_blocker_on_my_line
  AFTER INSERT ON sewing_actuals
  FOR EACH ROW
  EXECUTE FUNCTION notify_blocker_on_my_line();

DROP TRIGGER IF EXISTS trigger_notify_blocker_on_my_line ON finishing_actuals;
CREATE TRIGGER trigger_notify_blocker_on_my_line
  AFTER INSERT ON finishing_actuals
  FOR EACH ROW
  EXECUTE FUNCTION notify_blocker_on_my_line();

DROP TRIGGER IF EXISTS trigger_notify_blocker_on_my_line ON production_updates_sewing;
CREATE TRIGGER trigger_notify_blocker_on_my_line
  AFTER INSERT ON production_updates_sewing
  FOR EACH ROW
  EXECUTE FUNCTION notify_blocker_on_my_line();

DROP TRIGGER IF EXISTS trigger_notify_blocker_on_my_line ON production_updates_finishing;
CREATE TRIGGER trigger_notify_blocker_on_my_line
  AFTER INSERT ON production_updates_finishing
  FOR EACH ROW
  EXECUTE FUNCTION notify_blocker_on_my_line();
