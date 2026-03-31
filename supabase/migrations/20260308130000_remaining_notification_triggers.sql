-- ============================================================
-- Remaining notification triggers:
--   1. Fix display_name reference in notify_production_notes
--   2. Work Order Updates trigger
--   3. Shift Reminder scheduled function
--   4. General Notification broadcast helper for admins
-- ============================================================

-- ============================================================
-- 1. Fix notify_production_notes() - display_name doesn't exist
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_production_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line_name TEXT;
  submitter_name TEXT;
  admin_record RECORD;
  pref_enabled BOOLEAN;
  dept TEXT;
BEGIN
  -- Only fire when remarks is not empty
  IF NEW.remarks IS NULL OR trim(NEW.remarks) = '' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, skip if remarks haven't changed
  IF TG_OP = 'UPDATE' AND OLD.remarks IS NOT DISTINCT FROM NEW.remarks THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(l.name, l.line_id) INTO line_name
  FROM lines l WHERE l.id = NEW.line_id;

  -- Get submitter display name (use full_name)
  SELECT COALESCE(p.full_name, 'Unknown') INTO submitter_name
  FROM profiles p WHERE p.id = NEW.submitted_by;

  -- Determine department from table name
  IF TG_TABLE_NAME LIKE '%sewing%' THEN
    dept := 'Sewing';
  ELSIF TG_TABLE_NAME LIKE '%finishing%' THEN
    dept := 'Finishing';
  ELSE
    dept := 'Production';
  END IF;

  -- Notify admins/owners
  FOR admin_record IN
    SELECT p.id as user_id
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.factory_id = NEW.factory_id
      AND ur.role IN ('admin', 'owner')
      AND p.is_active = true
      AND p.id IS DISTINCT FROM NEW.submitted_by
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = admin_record.user_id AND notification_type = 'production_notes';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        NEW.factory_id,
        admin_record.user_id,
        'Production Note Added',
        dept || ' – Line ' || COALESCE(line_name, 'Unknown') || ': ' || left(trim(NEW.remarks), 120),
        'production_notes',
        jsonb_build_object(
          'line_id', NEW.line_id,
          'line_name', line_name,
          'department', dept,
          'remarks', NEW.remarks,
          'submitted_by', NEW.submitted_by,
          'submitter_name', submitter_name,
          'production_date', NEW.production_date,
          'submission_id', NEW.id,
          'table_name', TG_TABLE_NAME
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 2. Work Order Updates trigger
--    Fires when work order status or is_active changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_work_order_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
  pref_enabled BOOLEAN;
  change_desc TEXT;
BEGIN
  -- Determine what changed
  IF OLD.is_active = true AND NEW.is_active = false THEN
    change_desc := 'deactivated';
  ELSIF OLD.is_active = false AND NEW.is_active = true THEN
    change_desc := 'reactivated';
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    change_desc := 'status changed to ' || COALESCE(NEW.status, 'unknown');
  ELSIF OLD.planned_ex_factory IS DISTINCT FROM NEW.planned_ex_factory THEN
    change_desc := 'ex-factory date changed to ' || COALESCE(NEW.planned_ex_factory::text, 'not set');
  ELSIF OLD.order_qty IS DISTINCT FROM NEW.order_qty THEN
    change_desc := 'order quantity changed to ' || COALESCE(NEW.order_qty::text, '0');
  ELSE
    -- No significant change
    RETURN NEW;
  END IF;

  -- Notify admin/owner users in the factory
  FOR admin_record IN
    SELECT p.id as user_id
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.factory_id = NEW.factory_id
      AND ur.role IN ('admin', 'owner')
      AND p.is_active = true
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = admin_record.user_id AND notification_type = 'work_order_updates';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        NEW.factory_id,
        admin_record.user_id,
        'Work Order Updated',
        'PO ' || COALESCE(NEW.po_number, 'Unknown') || ' (' || COALESCE(NEW.buyer, '') || ' · ' || COALESCE(NEW.style, '') || ') ' || change_desc,
        'work_order_updates',
        jsonb_build_object(
          'work_order_id', NEW.id,
          'po_number', NEW.po_number,
          'buyer', NEW.buyer,
          'style', NEW.style,
          'change', change_desc,
          'is_active', NEW.is_active,
          'status', NEW.status
        )
      );
    END IF;
  END LOOP;

  -- Also notify line workers assigned to this work order's lines
  FOR admin_record IN
    SELECT DISTINCT ula.user_id
    FROM work_order_line_assignments wola
    JOIN user_line_assignments ula ON ula.line_id = wola.line_id
    JOIN profiles p ON p.id = ula.user_id
    WHERE wola.work_order_id = NEW.id
      AND p.factory_id = NEW.factory_id
      AND p.is_active = true
      -- Exclude admins (they already get notified above)
      AND NOT EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = ula.user_id AND ur.role IN ('admin', 'owner', 'superadmin')
      )
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = admin_record.user_id AND notification_type = 'work_order_updates';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        NEW.factory_id,
        admin_record.user_id,
        'Work Order Updated',
        'PO ' || COALESCE(NEW.po_number, 'Unknown') || ' ' || change_desc,
        'work_order_updates',
        jsonb_build_object(
          'work_order_id', NEW.id,
          'po_number', NEW.po_number,
          'buyer', NEW.buyer,
          'style', NEW.style,
          'change', change_desc,
          'is_active', NEW.is_active,
          'status', NEW.status
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_work_order_update ON work_orders;
CREATE TRIGGER trigger_notify_work_order_update
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_work_order_update();


-- ============================================================
-- 3. Scheduled notification processor (PL/pgSQL)
--    Handles late_submission, daily_summary, shift_reminder
--    Can be called by pg_cron or the edge function
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_scheduled_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  factory_rec RECORD;
  factory_now TIMESTAMPTZ;
  factory_hour INT;
  factory_minute INT;
  today_str TEXT;
  cutoff_hour INT;
  cutoff_min INT;
  target_cutoff_hour INT;
  target_cutoff_min INT;
  results jsonb := '{"late_submissions":0,"daily_summaries":0,"shift_reminders":0}'::jsonb;
BEGIN
  FOR factory_rec IN
    SELECT id, name, timezone, evening_actual_cutoff, morning_target_cutoff
    FROM factory_accounts
    WHERE subscription_status IN ('active', 'trialing', 'trial')
      AND is_active = true
  LOOP
    BEGIN
      -- Get current time in factory timezone
      factory_now := now() AT TIME ZONE COALESCE(factory_rec.timezone, 'Asia/Dhaka');
      factory_hour := EXTRACT(HOUR FROM factory_now);
      factory_minute := EXTRACT(MINUTE FROM factory_now);
      today_str := to_char(factory_now, 'YYYY-MM-DD');

      -- Parse evening cutoff (default 18:00)
      cutoff_hour := EXTRACT(HOUR FROM COALESCE(factory_rec.evening_actual_cutoff, '18:00:00'::time));
      cutoff_min := EXTRACT(MINUTE FROM COALESCE(factory_rec.evening_actual_cutoff, '18:00:00'::time));

      -- Parse morning cutoff (default 10:00)
      target_cutoff_hour := EXTRACT(HOUR FROM COALESCE(factory_rec.morning_target_cutoff, '10:00:00'::time));
      target_cutoff_min := EXTRACT(MINUTE FROM COALESCE(factory_rec.morning_target_cutoff, '10:00:00'::time));

      -- --- LATE SUBMISSION (cutoff + 30 min, 5-min window) ---
      DECLARE
        late_total_min INT := cutoff_hour * 60 + cutoff_min + 30;
        late_h INT := (late_total_min / 60) % 24;
        late_m INT := late_total_min % 60;
      BEGIN
        IF factory_hour = late_h AND factory_minute >= late_m AND factory_minute < late_m + 5 THEN
          PERFORM process_late_submissions(factory_rec.id, factory_rec.name, today_str);
          results := jsonb_set(results, '{late_submissions}', to_jsonb((results->>'late_submissions')::int + 1));
        END IF;
      END;

      -- --- DAILY SUMMARY (cutoff + 60 min, 5-min window) ---
      DECLARE
        summary_total_min INT := cutoff_hour * 60 + cutoff_min + 60;
        summary_h INT := (summary_total_min / 60) % 24;
        summary_m INT := summary_total_min % 60;
      BEGIN
        IF factory_hour = summary_h AND factory_minute >= summary_m AND factory_minute < summary_m + 5 THEN
          PERFORM process_daily_summary(factory_rec.id, factory_rec.name, today_str);
          results := jsonb_set(results, '{daily_summaries}', to_jsonb((results->>'daily_summaries')::int + 1));
        END IF;
      END;

      -- --- SHIFT REMINDER (30 min before morning cutoff, 5-min window) ---
      DECLARE
        reminder_total_min INT := target_cutoff_hour * 60 + target_cutoff_min - 30;
        reminder_h INT;
        reminder_m INT;
      BEGIN
        -- Handle wrap-around for very early cutoffs
        IF reminder_total_min < 0 THEN
          reminder_total_min := reminder_total_min + 1440;
        END IF;
        reminder_h := (reminder_total_min / 60) % 24;
        reminder_m := reminder_total_min % 60;

        IF factory_hour = reminder_h AND factory_minute >= reminder_m AND factory_minute < reminder_m + 5 THEN
          PERFORM process_shift_reminders(factory_rec.id, factory_rec.name, today_str, factory_rec.morning_target_cutoff);
          results := jsonb_set(results, '{shift_reminders}', to_jsonb((results->>'shift_reminders')::int + 1));
        END IF;
      END;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error processing factory %: %', factory_rec.id, SQLERRM;
    END;
  END LOOP;

  RETURN results;
END;
$$;


-- --- Late Submission sub-function ---
CREATE OR REPLACE FUNCTION public.process_late_submissions(
  p_factory_id UUID,
  p_factory_name TEXT,
  p_today TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  missing_lines jsonb;
  missing_count INT;
  admin_record RECORD;
  pref_enabled BOOLEAN;
  lines_summary TEXT;
BEGIN
  -- Check if already sent today
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE factory_id = p_factory_id AND type = 'late_submission'
      AND created_at >= (p_today || 'T00:00:00Z')::timestamptz
  ) THEN
    RETURN;
  END IF;

  -- Find lines that haven't submitted
  SELECT jsonb_agg(jsonb_build_object('id', l.id, 'name', COALESCE(l.name, l.line_id))),
         count(*)
  INTO missing_lines, missing_count
  FROM lines l
  WHERE l.factory_id = p_factory_id
    AND l.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM sewing_actuals sa
      WHERE sa.line_id = l.id AND sa.production_date = p_today::date
    )
    AND NOT EXISTS (
      SELECT 1 FROM finishing_actuals fa
      WHERE fa.line_id = l.id AND fa.production_date = p_today::date
    );

  IF missing_count = 0 OR missing_lines IS NULL THEN
    RETURN;
  END IF;

  -- Build summary text
  SELECT string_agg(elem->>'name', ', ')
  INTO lines_summary
  FROM (SELECT jsonb_array_elements(missing_lines) AS elem LIMIT 5) sub;

  IF missing_count > 5 THEN
    lines_summary := lines_summary || ' +' || (missing_count - 5) || ' more';
  END IF;

  -- Notify admin/owner users
  FOR admin_record IN
    SELECT p.id as user_id
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.factory_id = p_factory_id
      AND ur.role IN ('admin', 'owner')
      AND p.is_active = true
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = admin_record.user_id AND notification_type = 'late_submission';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        p_factory_id,
        admin_record.user_id,
        'Late Submission Alert',
        missing_count || ' line' || CASE WHEN missing_count > 1 THEN 's' ELSE '' END
          || ' missing end-of-day submissions: ' || lines_summary,
        'late_submission',
        jsonb_build_object(
          'production_date', p_today,
          'missing_count', missing_count,
          'missing_lines', missing_lines
        )
      );
    END IF;
  END LOOP;
END;
$$;


-- --- Daily Summary sub-function ---
CREATE OR REPLACE FUNCTION public.process_daily_summary(
  p_factory_id UUID,
  p_factory_name TEXT,
  p_today TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sewing_output NUMERIC := 0;
  sewing_target NUMERIC := 0;
  finishing_output NUMERIC := 0;
  active_blockers INT := 0;
  total_lines INT := 0;
  submitted_lines INT := 0;
  missing_lines INT := 0;
  avg_efficiency INT := 0;
  summary_msg TEXT;
  parts TEXT[] := '{}';
  admin_record RECORD;
  pref_enabled BOOLEAN;
BEGIN
  -- Check if already sent today
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE factory_id = p_factory_id AND type = 'daily_summary'
      AND created_at >= (p_today || 'T00:00:00Z')::timestamptz
  ) THEN
    RETURN;
  END IF;

  -- Get sewing stats (correct column: good_today)
  SELECT COALESCE(SUM(sa.good_today), 0)
  INTO sewing_output
  FROM sewing_actuals sa
  WHERE sa.factory_id = p_factory_id AND sa.production_date = p_today::date;

  -- Get sewing targets
  SELECT COALESCE(SUM(
    COALESCE(st.target_total_planned, st.per_hour_target * COALESCE(st.hours_planned, 8))
  ), 0)
  INTO sewing_target
  FROM sewing_targets st
  WHERE st.factory_id = p_factory_id AND st.production_date = p_today::date;

  -- Get finishing stats (correct column: day_qc_pass)
  SELECT COALESCE(SUM(fa.day_qc_pass), 0)
  INTO finishing_output
  FROM finishing_actuals fa
  WHERE fa.factory_id = p_factory_id AND fa.production_date = p_today::date;

  -- Count active blockers
  SELECT count(*) INTO active_blockers
  FROM (
    SELECT id FROM sewing_actuals
    WHERE factory_id = p_factory_id AND production_date = p_today::date AND has_blocker = true
    UNION ALL
    SELECT id FROM finishing_actuals
    WHERE factory_id = p_factory_id AND production_date = p_today::date AND has_blocker = true
  ) sub;

  -- Count lines
  SELECT count(*) INTO total_lines
  FROM lines WHERE factory_id = p_factory_id AND is_active = true;

  SELECT count(DISTINCT line_id) INTO submitted_lines
  FROM (
    SELECT line_id FROM sewing_actuals WHERE factory_id = p_factory_id AND production_date = p_today::date
    UNION
    SELECT line_id FROM finishing_actuals WHERE factory_id = p_factory_id AND production_date = p_today::date
  ) sub;

  missing_lines := total_lines - submitted_lines;
  avg_efficiency := CASE WHEN sewing_target > 0 THEN round((sewing_output / sewing_target) * 100) ELSE 0 END;

  -- Build message
  IF sewing_output > 0 THEN
    parts := array_append(parts, 'Sewing: ' || sewing_output || ' pcs (' || avg_efficiency || '% eff)');
  END IF;
  IF finishing_output > 0 THEN
    parts := array_append(parts, 'Finishing: ' || finishing_output || ' pcs');
  END IF;
  IF active_blockers > 0 THEN
    parts := array_append(parts, active_blockers || ' active blocker' || CASE WHEN active_blockers > 1 THEN 's' ELSE '' END);
  END IF;
  IF missing_lines > 0 THEN
    parts := array_append(parts, missing_lines || ' line' || CASE WHEN missing_lines > 1 THEN 's' ELSE '' END || ' missing');
  END IF;

  summary_msg := CASE WHEN array_length(parts, 1) > 0 THEN array_to_string(parts, ' | ') ELSE 'No production data today' END;

  -- Notify admin/owner users
  FOR admin_record IN
    SELECT p.id as user_id
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.factory_id = p_factory_id
      AND ur.role IN ('admin', 'owner')
      AND p.is_active = true
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = admin_record.user_id AND notification_type = 'daily_summary';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        p_factory_id,
        admin_record.user_id,
        'Daily Production Summary',
        summary_msg,
        'daily_summary',
        jsonb_build_object(
          'production_date', p_today,
          'sewing_output', sewing_output,
          'sewing_target', sewing_target,
          'finishing_output', finishing_output,
          'avg_efficiency', avg_efficiency,
          'active_blockers', active_blockers,
          'missing_lines', missing_lines,
          'total_lines', total_lines,
          'lines_submitted', submitted_lines
        )
      );
    END IF;
  END LOOP;
END;
$$;


-- --- Shift Reminder sub-function ---
CREATE OR REPLACE FUNCTION public.process_shift_reminders(
  p_factory_id UUID,
  p_factory_name TEXT,
  p_today TEXT,
  p_morning_cutoff TIME
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
  pref_enabled BOOLEAN;
  cutoff_display TEXT;
BEGIN
  -- Check if already sent today
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE factory_id = p_factory_id AND type = 'shift_reminder'
      AND created_at >= (p_today || 'T00:00:00Z')::timestamptz
  ) THEN
    RETURN;
  END IF;

  cutoff_display := to_char(COALESCE(p_morning_cutoff, '10:00:00'::time), 'HH12:MI AM');

  -- Notify ALL active users in the factory (shift reminders are for everyone)
  FOR user_record IN
    SELECT p.id as user_id
    FROM profiles p
    WHERE p.factory_id = p_factory_id
      AND p.is_active = true
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = user_record.user_id AND notification_type = 'shift_reminder';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        p_factory_id,
        user_record.user_id,
        'Shift Reminder',
        'Morning targets are due by ' || cutoff_display || '. Don''t forget to submit your targets!',
        'shift_reminder',
        jsonb_build_object(
          'production_date', p_today,
          'cutoff_time', p_morning_cutoff
        )
      );
    END IF;
  END LOOP;
END;
$$;


-- ============================================================
-- 4. General Notification broadcast helper
--    Admins can call this to send announcements to all users
-- ============================================================
CREATE OR REPLACE FUNCTION public.broadcast_notification(
  p_title TEXT,
  p_message TEXT,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_factory_id UUID;
  user_record RECORD;
  pref_enabled BOOLEAN;
  count INT := 0;
BEGIN
  -- Get caller's factory
  SELECT factory_id INTO caller_factory_id
  FROM profiles WHERE id = auth.uid();

  IF caller_factory_id IS NULL THEN
    RAISE EXCEPTION 'User not found or no factory assigned';
  END IF;

  -- Only admins/owners can broadcast
  IF NOT is_admin_or_higher(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can broadcast notifications';
  END IF;

  FOR user_record IN
    SELECT p.id as user_id
    FROM profiles p
    WHERE p.factory_id = caller_factory_id
      AND p.is_active = true
      AND p.id != auth.uid()  -- Don't notify self
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = user_record.user_id AND notification_type = 'general';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        caller_factory_id,
        user_record.user_id,
        p_title,
        p_message,
        'general',
        p_data
      );
      count := count + 1;
    END IF;
  END LOOP;

  RETURN count;
END;
$$;


-- ============================================================
-- 5. Enable pg_cron extension and schedule the processor
--    Runs every 5 minutes to check for timed notifications
-- ============================================================
-- Note: pg_cron may already be enabled. CREATE EXTENSION IF NOT EXISTS is safe.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the processor to run every 5 minutes
SELECT cron.schedule(
  'process-scheduled-notifications',
  '*/5 * * * *',
  $$SELECT public.process_scheduled_notifications()$$
);
