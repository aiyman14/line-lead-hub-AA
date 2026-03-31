-- ============================================================================
-- COMPREHENSIVE RLS FUNCTIONS, POLICIES, AND TRIGGERS SCRIPT
-- ============================================================================
-- Generated from all 153 migration files in supabase/migrations/
-- This script is IDEMPOTENT - safe to run multiple times.
--
-- It includes:
--   1. All custom security helper functions (CREATE OR REPLACE)
--   2. All RLS ENABLE statements
--   3. All RLS policies (DROP IF EXISTS + CREATE)
--   4. All trigger functions (CREATE OR REPLACE)
--   5. All triggers (DROP IF EXISTS + CREATE)
-- ============================================================================

-- ============================================================================
-- SECTION 1: CORE SECURITY HELPER FUNCTIONS
-- ============================================================================

-- has_role: Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- get_user_factory_id: Get user's factory_id from profiles
CREATE OR REPLACE FUNCTION public.get_user_factory_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT factory_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- user_belongs_to_factory: Check if user belongs to a specific factory
CREATE OR REPLACE FUNCTION public.user_belongs_to_factory(_user_id UUID, _factory_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id AND factory_id = _factory_id
    )
$$;

-- is_admin_or_higher: Check if user is admin, owner, or superadmin
-- NOTE: After migration 20260111, supervisor role was merged into admin.
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

-- is_superadmin: Check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = 'superadmin'
    )
$$;

-- is_supervisor_or_higher: Alias for is_admin_or_higher (backwards compat)
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

-- has_storage_role: Check if user has storage role
CREATE OR REPLACE FUNCTION public.has_storage_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'storage'
  )
$$;

-- has_cutting_role: Check if user has cutting role
CREATE OR REPLACE FUNCTION public.has_cutting_role(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = $1
      AND role = 'cutting'
  )
$$;

-- is_buyer_role: Check if user has buyer role
CREATE OR REPLACE FUNCTION public.is_buyer_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'buyer'
  )
$$;

-- factory_has_active_access: Check if factory has active subscription
CREATE OR REPLACE FUNCTION public.factory_has_active_access(_factory_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.factory_accounts
    WHERE id = _factory_id
    AND (
      subscription_status = 'active'
      OR subscription_status = 'trialing'
      OR (trial_end_date IS NOT NULL AND trial_end_date > NOW() AND subscription_status = 'trial')
    )
  )
$$;

-- count_active_lines: Count active lines for a factory
CREATE OR REPLACE FUNCTION public.count_active_lines(_factory_id uuid)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.lines
  WHERE factory_id = _factory_id AND is_active = true
$$;

-- get_plan_max_lines: Get max active lines for a factory's plan
CREATE OR REPLACE FUNCTION public.get_plan_max_lines(_factory_id uuid)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(max_lines,
    CASE subscription_tier
      WHEN 'starter' THEN 30
      WHEN 'growth' THEN 60
      WHEN 'scale' THEN 100
      WHEN 'enterprise' THEN NULL
      WHEN 'professional' THEN 60
      WHEN 'unlimited' THEN NULL
      ELSE 30
    END
  )
  FROM public.factory_accounts
  WHERE id = _factory_id
$$;

-- can_activate_line: Check if factory can activate another line
CREATE OR REPLACE FUNCTION public.can_activate_line(_factory_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN get_plan_max_lines(_factory_id) IS NULL THEN true
      ELSE count_active_lines(_factory_id) < get_plan_max_lines(_factory_id)
    END
$$;

-- get_buyer_membership_count: Count active buyer factory memberships
CREATE OR REPLACE FUNCTION public.get_buyer_membership_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.buyer_factory_memberships
  WHERE user_id = _user_id AND is_active = true
$$;

-- check_rate_limit: Rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_action_type text,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15,
  p_block_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_window_start timestamptz;
  v_now timestamptz := now();
BEGIN
  v_window_start := v_now - (p_window_minutes || ' minutes')::interval;
  SELECT * INTO v_record
  FROM rate_limits
  WHERE identifier = p_identifier AND action_type = p_action_type;
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'blocked', 'blocked_until', v_record.blocked_until, 'attempts', v_record.attempts);
  END IF;
  IF v_record.id IS NULL OR v_record.first_attempt_at < v_window_start THEN
    INSERT INTO rate_limits (identifier, action_type, attempts, first_attempt_at, last_attempt_at, blocked_until)
    VALUES (p_identifier, p_action_type, 1, v_now, v_now, NULL)
    ON CONFLICT (identifier, action_type)
    DO UPDATE SET attempts = 1, first_attempt_at = v_now, last_attempt_at = v_now, blocked_until = NULL;
    RETURN jsonb_build_object('allowed', true, 'attempts', 1);
  END IF;
  UPDATE rate_limits
  SET attempts = attempts + 1, last_attempt_at = v_now,
      blocked_until = CASE
        WHEN attempts + 1 >= p_max_attempts THEN v_now + (p_block_minutes || ' minutes')::interval
        ELSE NULL
      END
  WHERE identifier = p_identifier AND action_type = p_action_type
  RETURNING * INTO v_record;
  IF v_record.attempts >= p_max_attempts THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limited', 'blocked_until', v_record.blocked_until, 'attempts', v_record.attempts);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'attempts', v_record.attempts);
END;
$$;

-- log_security_event: Log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_user_id uuid DEFAULT NULL,
  p_factory_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO security_events (event_type, user_id, factory_id, ip_address, user_agent, details)
  VALUES (p_event_type, p_user_id, p_factory_id, p_ip_address, p_user_agent, p_details);
END;
$$;

-- search_knowledge: Vector similarity search for knowledge base
DROP FUNCTION IF EXISTS public.search_knowledge(vector, double precision, integer, uuid, text);
CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  p_factory_id uuid DEFAULT NULL,
  p_language text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  document_type text,
  content text,
  section_heading text,
  page_number int,
  similarity float,
  source_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id as chunk_id,
    kc.document_id,
    kd.title as document_title,
    kd.document_type,
    kc.content,
    kc.section_heading,
    kc.page_number,
    1 - (kc.embedding <=> query_embedding) as similarity,
    kd.source_url
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE kd.is_active = true
    AND (kd.is_global = true OR kd.factory_id = p_factory_id)
    AND (p_language IS NULL OR kd.language = p_language)
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- get_user_accessible_features: Get user's accessible features based on roles
CREATE OR REPLACE FUNCTION public.get_user_accessible_features(p_user_id uuid)
RETURNS TABLE (feature text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT rfa.feature
  FROM role_feature_access rfa
  JOIN user_roles ur ON ur.role::text = rfa.role
  WHERE ur.user_id = p_user_id;
$$;

-- increment_dispatch_sequence: Atomic sequence for dispatch reference numbers
CREATE OR REPLACE FUNCTION public.increment_dispatch_sequence(
  p_factory_id UUID,
  p_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence INTEGER;
BEGIN
  INSERT INTO public.dispatch_daily_sequence (factory_id, date, last_sequence)
  VALUES (p_factory_id, p_date, 1)
  ON CONFLICT (factory_id, date)
  DO UPDATE SET last_sequence = dispatch_daily_sequence.last_sequence + 1
  RETURNING last_sequence INTO v_sequence;
  RETURN v_sequence;
END;
$$;

-- validate_dispatch_quantity: Validation trigger for dispatch requests
CREATE OR REPLACE FUNCTION public.validate_dispatch_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dispatch_quantity <= 0 THEN
    RAISE EXCEPTION 'dispatch_quantity must be greater than 0';
  END IF;
  IF NEW.status NOT IN ('draft', 'pending', 'approved', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status value: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- broadcast_notification: Admin broadcast helper
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
  SELECT factory_id INTO caller_factory_id
  FROM profiles WHERE id = auth.uid();
  IF caller_factory_id IS NULL THEN
    RAISE EXCEPTION 'User not found or no factory assigned';
  END IF;
  IF NOT is_admin_or_higher(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can broadcast notifications';
  END IF;
  FOR user_record IN
    SELECT p.id as user_id FROM profiles p
    WHERE p.factory_id = caller_factory_id AND p.is_active = true AND p.id != auth.uid()
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = user_record.user_id AND notification_type = 'general';
    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (caller_factory_id, user_record.user_id, p_title, p_message, 'general', p_data);
      count := count + 1;
    END IF;
  END LOOP;
  RETURN count;
END;
$$;


-- ============================================================================
-- SECTION 2: TRIGGER FUNCTIONS
-- ============================================================================

-- update_updated_at_column: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- handle_new_user: Create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _factory_id uuid;
BEGIN
    IF NEW.raw_user_meta_data ->> 'factory_id' IS NOT NULL THEN
      _factory_id := (NEW.raw_user_meta_data ->> 'factory_id')::uuid;
    ELSE
      _factory_id := NULL;
    END IF;

    INSERT INTO public.profiles (id, full_name, email, factory_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        NEW.email,
        _factory_id
    )
    ON CONFLICT (id) DO UPDATE SET
        factory_id = COALESCE(EXCLUDED.factory_id, profiles.factory_id),
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

    IF COALESCE(NEW.raw_user_meta_data ->> 'invited_by_admin', 'false') = 'true' THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin');
    END IF;

    RETURN NEW;
END;
$$;

-- enforce_line_activation_limit: Enforce plan line limits
CREATE OR REPLACE FUNCTION public.enforce_line_activation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_lines INTEGER;
  current_active INTEGER;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.is_active = false AND NEW.is_active = true)
     OR (TG_OP = 'INSERT' AND NEW.is_active = true) THEN
    max_lines := get_plan_max_lines(NEW.factory_id);
    IF max_lines IS NOT NULL THEN
      current_active := count_active_lines(NEW.factory_id);
      IF current_active >= max_lines THEN
        RAISE EXCEPTION 'Plan limit reached (% of % active lines). Upgrade your plan to activate more lines.',
          current_active, max_lines
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    NEW.deactivated_at := NOW();
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_active = false AND NEW.is_active = true THEN
    NEW.deactivated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- prevent_work_order_delete: Prevent hard deletion of work orders
CREATE OR REPLACE FUNCTION public.prevent_work_order_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Work orders cannot be deleted. Set is_active = false and status = ''deleted'' instead.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- notify_low_efficiency: Alert on low production efficiency
CREATE OR REPLACE FUNCTION public.notify_low_efficiency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_efficiency INTEGER;
  daily_target NUMERIC;
  daily_output NUMERIC;
  calculated_efficiency NUMERIC;
  admin_record RECORD;
  line_name TEXT;
  pref_enabled BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'sewing_actuals' THEN
    daily_output := COALESCE(NEW.good_today, 0);
    SELECT COALESCE(st.target_total_planned, st.per_hour_target * COALESCE(st.hours_planned, 8))
    INTO daily_target
    FROM sewing_targets st
    WHERE st.factory_id = NEW.factory_id
      AND st.production_date = NEW.production_date
      AND st.line_id = NEW.line_id
      AND st.work_order_id = NEW.work_order_id;
  ELSIF TG_TABLE_NAME = 'finishing_actuals' THEN
    daily_output := COALESCE(NEW.day_qc_pass, 0);
    SELECT ft.per_hour_target * COALESCE(ft.day_hour_planned, 8)
    INTO daily_target
    FROM finishing_targets ft
    WHERE ft.factory_id = NEW.factory_id
      AND ft.production_date = NEW.production_date
      AND ft.line_id = NEW.line_id
      AND ft.work_order_id = NEW.work_order_id;
  ELSIF TG_TABLE_NAME = 'production_updates_sewing' THEN
    daily_output := COALESCE(NEW.output_qty, 0);
    daily_target := COALESCE(NEW.target_qty, 0);
  ELSIF TG_TABLE_NAME = 'production_updates_finishing' THEN
    daily_output := COALESCE(NEW.qc_pass_qty, 0);
    daily_target := COALESCE(NEW.per_hour_target, 0);
  ELSE
    RETURN NEW;
  END IF;

  IF COALESCE(daily_target, 0) <= 0 OR daily_output <= 0 THEN
    RETURN NEW;
  END IF;

  calculated_efficiency := (daily_output / daily_target) * 100;

  SELECT COALESCE(l.target_efficiency, 85), COALESCE(l.name, l.line_id)
  INTO target_efficiency, line_name
  FROM lines l WHERE l.id = NEW.line_id;

  target_efficiency := COALESCE(target_efficiency, 85);

  IF calculated_efficiency < target_efficiency THEN
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
      WHERE user_id = admin_record.user_id AND notification_type = 'low_efficiency';

      IF pref_enabled IS NULL OR pref_enabled = true THEN
        INSERT INTO notifications (factory_id, user_id, title, message, type, data)
        VALUES (
          NEW.factory_id,
          admin_record.user_id,
          'Low Efficiency Alert',
          'Line ' || COALESCE(line_name, 'Unknown') || ' efficiency at ' || round(calculated_efficiency, 1) || '% (target: ' || target_efficiency || '%)',
          'low_efficiency',
          jsonb_build_object(
            'line_id', NEW.line_id,
            'efficiency', round(calculated_efficiency, 1),
            'target', target_efficiency,
            'submission_id', NEW.id,
            'table_name', TG_TABLE_NAME
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- notify_critical_blocker: Alert on critical/high impact blockers
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
  IF NEW.has_blocker IS NOT TRUE OR NEW.blocker_impact NOT IN ('critical', 'high') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(l.name, l.line_id) INTO line_name
  FROM lines l WHERE l.id = NEW.line_id;

  IF NEW.blocker_type_id IS NOT NULL THEN
    SELECT COALESCE(bt.name, 'Unknown') INTO blocker_name
    FROM blocker_types bt WHERE bt.id = NEW.blocker_type_id;
  ELSE
    blocker_name := 'Unknown';
  END IF;

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
    WHERE user_id = admin_record.user_id AND notification_type = 'critical_blocker';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        NEW.factory_id,
        admin_record.user_id,
        'Critical Blocker Reported',
        'Line ' || COALESCE(line_name, 'Unknown') || ': ' || COALESCE(blocker_name, 'Unknown') || ' (' || NEW.blocker_impact || ' impact)',
        'critical_blocker',
        jsonb_build_object(
          'line_id', NEW.line_id,
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

-- notify_blocker_on_my_line: Notify line workers about blockers on their line
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
  IF NEW.has_blocker IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(l.name, l.line_id) INTO line_name
  FROM lines l WHERE l.id = NEW.line_id;

  IF NEW.blocker_type_id IS NOT NULL THEN
    SELECT COALESCE(bt.name, 'Unknown') INTO blocker_name
    FROM blocker_types bt WHERE bt.id = NEW.blocker_type_id;
  ELSE
    blocker_name := 'Unknown';
  END IF;

  FOR user_record IN
    SELECT DISTINCT sub.user_id
    FROM (
      SELECT ula.user_id
      FROM user_line_assignments ula
      JOIN profiles p ON p.id = ula.user_id
      WHERE ula.line_id = NEW.line_id
        AND p.factory_id = NEW.factory_id
        AND p.is_active = true
      UNION
      SELECT p.id AS user_id
      FROM profiles p
      WHERE p.assigned_unit_id = NEW.line_id
        AND p.factory_id = NEW.factory_id
        AND p.is_active = true
    ) sub
    WHERE sub.user_id IS DISTINCT FROM NEW.submitted_by
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = sub.user_id
        AND ur.role IN ('admin', 'owner', 'superadmin')
    )
  LOOP
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

-- notify_target_achieved: Notify when line output meets/exceeds target
CREATE OR REPLACE FUNCTION public.notify_target_achieved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  daily_target NUMERIC;
  daily_output NUMERIC;
  achievement_pct NUMERIC;
  line_name TEXT;
  user_record RECORD;
  pref_enabled BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'sewing_actuals' THEN
    daily_output := COALESCE(NEW.good_today, 0);
    SELECT COALESCE(st.target_total_planned, st.per_hour_target * COALESCE(st.hours_planned, 8))
    INTO daily_target
    FROM sewing_targets st
    WHERE st.factory_id = NEW.factory_id
      AND st.production_date = NEW.production_date
      AND st.line_id = NEW.line_id
      AND st.work_order_id = NEW.work_order_id;
  ELSIF TG_TABLE_NAME = 'finishing_actuals' THEN
    daily_output := COALESCE(NEW.day_qc_pass, 0);
    SELECT ft.per_hour_target * COALESCE(ft.day_hour_planned, 8)
    INTO daily_target
    FROM finishing_targets ft
    WHERE ft.factory_id = NEW.factory_id
      AND ft.production_date = NEW.production_date
      AND ft.line_id = NEW.line_id
      AND ft.work_order_id = NEW.work_order_id;
  ELSE
    RETURN NEW;
  END IF;

  IF COALESCE(daily_target, 0) <= 0 OR daily_output < daily_target THEN
    RETURN NEW;
  END IF;

  achievement_pct := round((daily_output / daily_target) * 100, 1);

  SELECT COALESCE(l.name, l.line_id) INTO line_name
  FROM lines l WHERE l.id = NEW.line_id;

  FOR user_record IN
    SELECT DISTINCT sub.user_id
    FROM (
      SELECT ula.user_id
      FROM user_line_assignments ula
      JOIN profiles p ON p.id = ula.user_id
      WHERE ula.line_id = NEW.line_id AND p.factory_id = NEW.factory_id AND p.is_active = true
      UNION
      SELECT p.id AS user_id FROM profiles p
      WHERE p.assigned_unit_id = NEW.line_id AND p.factory_id = NEW.factory_id AND p.is_active = true
      UNION
      SELECT p.id AS user_id FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.factory_id = NEW.factory_id AND ur.role IN ('admin', 'owner') AND p.is_active = true
    ) sub
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = user_record.user_id AND notification_type = 'target_achieved';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        NEW.factory_id,
        user_record.user_id,
        'Target Achieved',
        'Line ' || COALESCE(line_name, 'Unknown') || ' hit ' || achievement_pct || '% of target (' || round(daily_output) || '/' || round(daily_target) || ')',
        'target_achieved',
        jsonb_build_object(
          'line_id', NEW.line_id,
          'line_name', line_name,
          'output', daily_output,
          'target', daily_target,
          'achievement_pct', achievement_pct,
          'submission_id', NEW.id,
          'table_name', TG_TABLE_NAME
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- notify_blocker_resolved: Notify when blocker is resolved
CREATE OR REPLACE FUNCTION public.notify_blocker_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line_name TEXT;
  blocker_name TEXT;
  admin_record RECORD;
  pref_enabled BOOLEAN;
BEGIN
  IF NOT (
    (OLD.has_blocker = true AND NEW.has_blocker = false) OR
    (OLD.has_blocker = true AND OLD.blocker_resolution_date IS NULL AND NEW.blocker_resolution_date IS NOT NULL)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(l.name, l.line_id) INTO line_name
  FROM lines l WHERE l.id = NEW.line_id;

  IF OLD.blocker_type_id IS NOT NULL THEN
    SELECT COALESCE(bt.name, 'Unknown') INTO blocker_name
    FROM blocker_types bt WHERE bt.id = OLD.blocker_type_id;
  ELSE
    blocker_name := 'Unknown';
  END IF;

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
    WHERE user_id = admin_record.user_id AND notification_type = 'blocker_resolved';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        NEW.factory_id,
        admin_record.user_id,
        'Blocker Resolved',
        'Line ' || COALESCE(line_name, 'Unknown') || ': ' || COALESCE(blocker_name, 'Unknown') || ' has been resolved',
        'blocker_resolved',
        jsonb_build_object(
          'line_id', NEW.line_id,
          'line_name', line_name,
          'blocker_type', blocker_name,
          'impact', OLD.blocker_impact,
          'submission_id', NEW.id,
          'table_name', TG_TABLE_NAME
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- notify_production_notes: Notify admins when remarks are added
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
  IF NEW.remarks IS NULL OR trim(NEW.remarks) = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.remarks IS NOT DISTINCT FROM NEW.remarks THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(l.name, l.line_id) INTO line_name
  FROM lines l WHERE l.id = NEW.line_id;

  SELECT COALESCE(p.full_name, 'Unknown') INTO submitter_name
  FROM profiles p WHERE p.id = NEW.submitted_by;

  IF TG_TABLE_NAME LIKE '%sewing%' THEN
    dept := 'Sewing';
  ELSIF TG_TABLE_NAME LIKE '%finishing%' THEN
    dept := 'Finishing';
  ELSE
    dept := 'Production';
  END IF;

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

-- notify_sewing_on_cutting_actual: Notify sewing users on cutting handoff
CREATE OR REPLACE FUNCTION public.notify_sewing_on_cutting_actual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sewing_user RECORD;
  line_name TEXT;
  pref_enabled BOOLEAN;
BEGIN
  IF NEW.transfer_to_line_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(l.name, l.line_id) INTO line_name
  FROM lines l WHERE l.id = NEW.transfer_to_line_id;

  FOR sewing_user IN
    SELECT DISTINCT ula.user_id
    FROM user_line_assignments ula
    JOIN profiles p ON p.id = ula.user_id
    WHERE ula.line_id = NEW.transfer_to_line_id
    AND p.factory_id = NEW.factory_id
    AND p.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = ula.user_id
      AND ur.role IN ('admin', 'owner', 'superadmin')
    )
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = sewing_user.user_id AND notification_type = 'cutting_handoff';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        NEW.factory_id,
        sewing_user.user_id,
        'Cutting Handoff Received',
        'Cutting submitted ' || COALESCE(NEW.day_input, 0) || ' pcs for ' || COALESCE(line_name, 'your line') || ' - PO: ' || COALESCE(NEW.po_no, 'N/A'),
        'cutting_handoff',
        jsonb_build_object(
          'cutting_actual_id', NEW.id,
          'line_id', NEW.transfer_to_line_id,
          'line_name', line_name,
          'po_no', NEW.po_no,
          'style', NEW.style,
          'day_input', NEW.day_input,
          'day_cutting', NEW.day_cutting,
          'production_date', NEW.production_date
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- notify_work_order_update: Notify on work order changes
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
    RETURN NEW;
  END IF;

  FOR admin_record IN
    SELECT p.id as user_id FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.factory_id = NEW.factory_id AND ur.role IN ('admin', 'owner') AND p.is_active = true
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = admin_record.user_id AND notification_type = 'work_order_updates';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        NEW.factory_id, admin_record.user_id,
        'Work Order Updated',
        'PO ' || COALESCE(NEW.po_number, 'Unknown') || ' (' || COALESCE(NEW.buyer, '') || ' · ' || COALESCE(NEW.style, '') || ') ' || change_desc,
        'work_order_updates',
        jsonb_build_object('work_order_id', NEW.id, 'po_number', NEW.po_number, 'buyer', NEW.buyer, 'style', NEW.style, 'change', change_desc, 'is_active', NEW.is_active, 'status', NEW.status)
      );
    END IF;
  END LOOP;

  FOR admin_record IN
    SELECT DISTINCT ula.user_id
    FROM work_order_line_assignments wola
    JOIN user_line_assignments ula ON ula.line_id = wola.line_id
    JOIN profiles p ON p.id = ula.user_id
    WHERE wola.work_order_id = NEW.id AND p.factory_id = NEW.factory_id AND p.is_active = true
    AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = ula.user_id AND ur.role IN ('admin', 'owner', 'superadmin'))
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = admin_record.user_id AND notification_type = 'work_order_updates';

    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        NEW.factory_id, admin_record.user_id,
        'Work Order Updated',
        'PO ' || COALESCE(NEW.po_number, 'Unknown') || ' ' || change_desc,
        'work_order_updates',
        jsonb_build_object('work_order_id', NEW.id, 'po_number', NEW.po_number, 'buyer', NEW.buyer, 'style', NEW.style, 'change', change_desc, 'is_active', NEW.is_active, 'status', NEW.status)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- notify_push_on_insert: Fire push notification edge function
CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  service_url text;
  service_key text;
BEGIN
  IF new.user_id IS NULL THEN
    RETURN new;
  END IF;
  SELECT current_setting('app.supabase_url', true) INTO service_url;
  SELECT current_setting('app.service_role_key', true) INTO service_key;
  PERFORM net.http_post(
    url := service_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('notification_id', new.id, 'user_id', new.user_id, 'title', new.title, 'message', coalesce(new.message, ''), 'type', new.type, 'data', coalesce(new.data, '{}'::jsonb))
  );
  RETURN new;
EXCEPTION WHEN others THEN
  RAISE WARNING 'Push notification trigger failed: %', sqlerrm;
  RETURN new;
END;
$$;

-- Scheduled notification functions
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
    WHERE subscription_status IN ('active', 'trialing', 'trial') AND is_active = true
  LOOP
    BEGIN
      factory_now := now() AT TIME ZONE COALESCE(factory_rec.timezone, 'Asia/Dhaka');
      factory_hour := EXTRACT(HOUR FROM factory_now);
      factory_minute := EXTRACT(MINUTE FROM factory_now);
      today_str := to_char(factory_now, 'YYYY-MM-DD');
      cutoff_hour := EXTRACT(HOUR FROM COALESCE(factory_rec.evening_actual_cutoff, '18:00:00'::time));
      cutoff_min := EXTRACT(MINUTE FROM COALESCE(factory_rec.evening_actual_cutoff, '18:00:00'::time));
      target_cutoff_hour := EXTRACT(HOUR FROM COALESCE(factory_rec.morning_target_cutoff, '10:00:00'::time));
      target_cutoff_min := EXTRACT(MINUTE FROM COALESCE(factory_rec.morning_target_cutoff, '10:00:00'::time));
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
      DECLARE
        reminder_total_min INT := target_cutoff_hour * 60 + target_cutoff_min - 30;
        reminder_h INT;
        reminder_m INT;
      BEGIN
        IF reminder_total_min < 0 THEN reminder_total_min := reminder_total_min + 1440; END IF;
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

CREATE OR REPLACE FUNCTION public.process_late_submissions(p_factory_id UUID, p_factory_name TEXT, p_today TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE missing_lines jsonb; missing_count INT; admin_record RECORD; pref_enabled BOOLEAN; lines_summary TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM notifications WHERE factory_id = p_factory_id AND type = 'late_submission' AND created_at >= (p_today || 'T00:00:00Z')::timestamptz) THEN RETURN; END IF;
  SELECT jsonb_agg(jsonb_build_object('id', l.id, 'name', COALESCE(l.name, l.line_id))), count(*)
  INTO missing_lines, missing_count FROM lines l
  WHERE l.factory_id = p_factory_id AND l.is_active = true
    AND NOT EXISTS (SELECT 1 FROM sewing_actuals sa WHERE sa.line_id = l.id AND sa.production_date = p_today::date)
    AND NOT EXISTS (SELECT 1 FROM finishing_actuals fa WHERE fa.line_id = l.id AND fa.production_date = p_today::date);
  IF missing_count = 0 OR missing_lines IS NULL THEN RETURN; END IF;
  SELECT string_agg(elem->>'name', ', ') INTO lines_summary FROM (SELECT jsonb_array_elements(missing_lines) AS elem LIMIT 5) sub;
  IF missing_count > 5 THEN lines_summary := lines_summary || ' +' || (missing_count - 5) || ' more'; END IF;
  FOR admin_record IN SELECT p.id as user_id FROM profiles p JOIN user_roles ur ON ur.user_id = p.id WHERE p.factory_id = p_factory_id AND ur.role IN ('admin', 'owner') AND p.is_active = true
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled FROM notification_preferences WHERE user_id = admin_record.user_id AND notification_type = 'late_submission';
    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (p_factory_id, admin_record.user_id, 'Late Submission Alert',
        missing_count || ' line' || CASE WHEN missing_count > 1 THEN 's' ELSE '' END || ' missing end-of-day submissions: ' || lines_summary,
        'late_submission', jsonb_build_object('production_date', p_today, 'missing_count', missing_count, 'missing_lines', missing_lines));
    END IF;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.process_daily_summary(p_factory_id UUID, p_factory_name TEXT, p_today TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sewing_output NUMERIC := 0; sewing_target NUMERIC := 0; finishing_output NUMERIC := 0;
  active_blockers INT := 0; total_lines INT := 0; submitted_lines INT := 0;
  missing_lines INT := 0; avg_efficiency INT := 0; summary_msg TEXT; parts TEXT[] := '{}';
  admin_record RECORD; pref_enabled BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM notifications WHERE factory_id = p_factory_id AND type = 'daily_summary' AND created_at >= (p_today || 'T00:00:00Z')::timestamptz) THEN RETURN; END IF;
  SELECT COALESCE(SUM(sa.good_today), 0) INTO sewing_output FROM sewing_actuals sa WHERE sa.factory_id = p_factory_id AND sa.production_date = p_today::date;
  SELECT COALESCE(SUM(COALESCE(st.target_total_planned, st.per_hour_target * COALESCE(st.hours_planned, 8))), 0) INTO sewing_target FROM sewing_targets st WHERE st.factory_id = p_factory_id AND st.production_date = p_today::date;
  SELECT COALESCE(SUM(fa.day_qc_pass), 0) INTO finishing_output FROM finishing_actuals fa WHERE fa.factory_id = p_factory_id AND fa.production_date = p_today::date;
  SELECT count(*) INTO active_blockers FROM (SELECT id FROM sewing_actuals WHERE factory_id = p_factory_id AND production_date = p_today::date AND has_blocker = true UNION ALL SELECT id FROM finishing_actuals WHERE factory_id = p_factory_id AND production_date = p_today::date AND has_blocker = true) sub;
  SELECT count(*) INTO total_lines FROM lines WHERE factory_id = p_factory_id AND is_active = true;
  SELECT count(DISTINCT line_id) INTO submitted_lines FROM (SELECT line_id FROM sewing_actuals WHERE factory_id = p_factory_id AND production_date = p_today::date UNION SELECT line_id FROM finishing_actuals WHERE factory_id = p_factory_id AND production_date = p_today::date) sub;
  missing_lines := total_lines - submitted_lines;
  avg_efficiency := CASE WHEN sewing_target > 0 THEN round((sewing_output / sewing_target) * 100) ELSE 0 END;
  IF sewing_output > 0 THEN parts := array_append(parts, 'Sewing: ' || sewing_output || ' pcs (' || avg_efficiency || '% eff)'); END IF;
  IF finishing_output > 0 THEN parts := array_append(parts, 'Finishing: ' || finishing_output || ' pcs'); END IF;
  IF active_blockers > 0 THEN parts := array_append(parts, active_blockers || ' active blocker' || CASE WHEN active_blockers > 1 THEN 's' ELSE '' END); END IF;
  IF missing_lines > 0 THEN parts := array_append(parts, missing_lines || ' line' || CASE WHEN missing_lines > 1 THEN 's' ELSE '' END || ' missing'); END IF;
  summary_msg := CASE WHEN array_length(parts, 1) > 0 THEN array_to_string(parts, ' | ') ELSE 'No production data today' END;
  FOR admin_record IN SELECT p.id as user_id FROM profiles p JOIN user_roles ur ON ur.user_id = p.id WHERE p.factory_id = p_factory_id AND ur.role IN ('admin', 'owner') AND p.is_active = true
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled FROM notification_preferences WHERE user_id = admin_record.user_id AND notification_type = 'daily_summary';
    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (p_factory_id, admin_record.user_id, 'Daily Production Summary', summary_msg, 'daily_summary',
        jsonb_build_object('production_date', p_today, 'sewing_output', sewing_output, 'sewing_target', sewing_target, 'finishing_output', finishing_output, 'avg_efficiency', avg_efficiency, 'active_blockers', active_blockers, 'missing_lines', missing_lines, 'total_lines', total_lines, 'lines_submitted', submitted_lines));
    END IF;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.process_shift_reminders(p_factory_id UUID, p_factory_name TEXT, p_today TEXT, p_morning_cutoff TIME)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_record RECORD; pref_enabled BOOLEAN; cutoff_display TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM notifications WHERE factory_id = p_factory_id AND type = 'shift_reminder' AND created_at >= (p_today || 'T00:00:00Z')::timestamptz) THEN RETURN; END IF;
  cutoff_display := to_char(COALESCE(p_morning_cutoff, '10:00:00'::time), 'HH12:MI AM');
  FOR user_record IN SELECT p.id as user_id FROM profiles p WHERE p.factory_id = p_factory_id AND p.is_active = true
  LOOP
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled FROM notification_preferences WHERE user_id = user_record.user_id AND notification_type = 'shift_reminder';
    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (p_factory_id, user_record.user_id, 'Shift Reminder', 'Morning targets are due by ' || cutoff_display || '. Don''t forget to submit your targets!', 'shift_reminder',
        jsonb_build_object('production_date', p_today, 'cutoff_time', p_morning_cutoff));
    END IF;
  END LOOP;
END; $$;

-- update_invoices_updated_at
CREATE OR REPLACE FUNCTION public.update_invoices_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- update_factory_finance_settings_updated_at
CREATE OR REPLACE FUNCTION public.update_factory_finance_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


-- ============================================================================
-- SECTION 3: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE IF EXISTS public.factory_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocker_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_updates_sewing ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_updates_finishing ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stage_progress_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.next_milestone_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocker_owner_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocker_impact_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_line_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sewing_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sewing_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.finishing_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.finishing_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.work_order_line_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.storage_bin_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.storage_bin_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cutting_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cutting_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cutting_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.finishing_daily_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.finishing_hourly_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.finishing_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.finishing_daily_log_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.extras_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.document_ingestion_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_feature_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.buyer_po_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.buyer_factory_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.buyer_workspace_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.form_role_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.custom_dropdown_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.custom_dropdown_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_note_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dispatch_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dispatch_daily_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_tax_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.factory_finance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.factory_bank_accounts ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- SECTION 4: DROP ALL EXISTING RLS POLICIES (clean slate)
-- ============================================================================

-- factory_accounts
DROP POLICY IF EXISTS "Users can view their factory" ON public.factory_accounts;
DROP POLICY IF EXISTS "Users can view their factory basic info" ON public.factory_accounts;
DROP POLICY IF EXISTS "Superadmins can manage all factories" ON public.factory_accounts;
DROP POLICY IF EXISTS "Admins can create factory if no factory assigned" ON public.factory_accounts;
DROP POLICY IF EXISTS "Admins can update their factory" ON public.factory_accounts;
DROP POLICY IF EXISTS "Users without factory can create one" ON public.factory_accounts;

-- profiles
DROP POLICY IF EXISTS "Users can view profiles in their factory" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Supervisors can view all profiles in factory" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their factory" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles in their factory" ON public.profiles;

-- user_roles
DROP POLICY IF EXISTS "Users can view roles in their factory" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view factory roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- units
DROP POLICY IF EXISTS "Users can view units in their factory" ON public.units;
DROP POLICY IF EXISTS "Admins can manage units" ON public.units;

-- floors
DROP POLICY IF EXISTS "Users can view floors in their factory" ON public.floors;
DROP POLICY IF EXISTS "Admins can manage floors" ON public.floors;

-- lines
DROP POLICY IF EXISTS "Users can view lines in their factory" ON public.lines;
DROP POLICY IF EXISTS "Admins can manage lines" ON public.lines;

-- work_orders
DROP POLICY IF EXISTS "Users can view work orders in their factory" ON public.work_orders;
DROP POLICY IF EXISTS "Admins can manage work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Supervisors can view work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Workers can view assigned work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Factory users can view work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Buyers can view assigned work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Cutting users can view factory work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Storage users can view factory work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Sewing workers can view assigned work orders" ON public.work_orders;

-- stages
DROP POLICY IF EXISTS "Users can view stages in their factory" ON public.stages;
DROP POLICY IF EXISTS "Admins can manage stages" ON public.stages;

-- blocker_types
DROP POLICY IF EXISTS "Users can view blocker types in their factory" ON public.blocker_types;
DROP POLICY IF EXISTS "Admins can manage blocker types" ON public.blocker_types;

-- production_updates_sewing
DROP POLICY IF EXISTS "Users can view sewing updates in their factory" ON public.production_updates_sewing;
DROP POLICY IF EXISTS "Users can submit sewing updates" ON public.production_updates_sewing;
DROP POLICY IF EXISTS "Admins can update sewing updates" ON public.production_updates_sewing;
DROP POLICY IF EXISTS "Admins can delete sewing updates" ON public.production_updates_sewing;

-- production_updates_finishing
DROP POLICY IF EXISTS "Users can view finishing updates in their factory" ON public.production_updates_finishing;
DROP POLICY IF EXISTS "Users can submit finishing updates" ON public.production_updates_finishing;
DROP POLICY IF EXISTS "Admins can update finishing updates" ON public.production_updates_finishing;
DROP POLICY IF EXISTS "Admins can delete finishing updates" ON public.production_updates_finishing;

-- daily_insights
DROP POLICY IF EXISTS "Users can view insights in their factory" ON public.daily_insights;
DROP POLICY IF EXISTS "Supervisors can view insights" ON public.daily_insights;
DROP POLICY IF EXISTS "System can insert insights" ON public.daily_insights;

-- notifications
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

-- audit_log
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_log;

-- stage_progress_options
DROP POLICY IF EXISTS "Users can view stage_progress_options in their factory" ON public.stage_progress_options;
DROP POLICY IF EXISTS "Admins can manage stage_progress_options" ON public.stage_progress_options;

-- next_milestone_options
DROP POLICY IF EXISTS "Users can view next_milestone_options in their factory" ON public.next_milestone_options;
DROP POLICY IF EXISTS "Admins can manage next_milestone_options" ON public.next_milestone_options;

-- blocker_owner_options
DROP POLICY IF EXISTS "Users can view blocker_owner_options in their factory" ON public.blocker_owner_options;
DROP POLICY IF EXISTS "Admins can manage blocker_owner_options" ON public.blocker_owner_options;

-- blocker_impact_options
DROP POLICY IF EXISTS "Users can view blocker_impact_options in their factory" ON public.blocker_impact_options;
DROP POLICY IF EXISTS "Admins can manage blocker_impact_options" ON public.blocker_impact_options;

-- email_schedules
DROP POLICY IF EXISTS "Users can view their own email schedules" ON public.email_schedules;
DROP POLICY IF EXISTS "Users can manage their own email schedules" ON public.email_schedules;

-- notification_preferences
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.notification_preferences;

-- user_line_assignments
DROP POLICY IF EXISTS "Admins can manage user line assignments" ON public.user_line_assignments;
DROP POLICY IF EXISTS "Users can view line assignments in their factory" ON public.user_line_assignments;

-- sewing_targets
DROP POLICY IF EXISTS "Users can view sewing targets in their factory" ON public.sewing_targets;
DROP POLICY IF EXISTS "Factory users can view sewing targets" ON public.sewing_targets;
DROP POLICY IF EXISTS "Buyers can view sewing targets for assigned POs" ON public.sewing_targets;
DROP POLICY IF EXISTS "Users can submit sewing targets" ON public.sewing_targets;
DROP POLICY IF EXISTS "Admins can update sewing targets" ON public.sewing_targets;
DROP POLICY IF EXISTS "Admins can delete sewing targets" ON public.sewing_targets;
DROP POLICY IF EXISTS "Users can update their own sewing targets" ON public.sewing_targets;

-- sewing_actuals
DROP POLICY IF EXISTS "Users can view sewing actuals in their factory" ON public.sewing_actuals;
DROP POLICY IF EXISTS "Factory users can view sewing actuals" ON public.sewing_actuals;
DROP POLICY IF EXISTS "Buyers can view sewing actuals for assigned POs" ON public.sewing_actuals;
DROP POLICY IF EXISTS "Users can submit sewing actuals" ON public.sewing_actuals;
DROP POLICY IF EXISTS "Admins can update sewing actuals" ON public.sewing_actuals;
DROP POLICY IF EXISTS "Admins can delete sewing actuals" ON public.sewing_actuals;
DROP POLICY IF EXISTS "Users can update their own sewing actuals" ON public.sewing_actuals;

-- finishing_targets
DROP POLICY IF EXISTS "Users can view finishing targets in their factory" ON public.finishing_targets;
DROP POLICY IF EXISTS "Factory users can view finishing targets" ON public.finishing_targets;
DROP POLICY IF EXISTS "Buyers can view finishing targets for assigned POs" ON public.finishing_targets;
DROP POLICY IF EXISTS "Users can submit finishing targets" ON public.finishing_targets;
DROP POLICY IF EXISTS "Admins can update finishing targets" ON public.finishing_targets;
DROP POLICY IF EXISTS "Admins can delete finishing targets" ON public.finishing_targets;
DROP POLICY IF EXISTS "Users can update their own finishing targets" ON public.finishing_targets;

-- finishing_actuals
DROP POLICY IF EXISTS "Users can view finishing actuals in their factory" ON public.finishing_actuals;
DROP POLICY IF EXISTS "Factory users can view finishing actuals" ON public.finishing_actuals;
DROP POLICY IF EXISTS "Buyers can view finishing actuals for assigned POs" ON public.finishing_actuals;
DROP POLICY IF EXISTS "Users can submit finishing actuals" ON public.finishing_actuals;
DROP POLICY IF EXISTS "Admins can update finishing actuals" ON public.finishing_actuals;
DROP POLICY IF EXISTS "Admins can delete finishing actuals" ON public.finishing_actuals;
DROP POLICY IF EXISTS "Users can update their own finishing actuals" ON public.finishing_actuals;

-- work_order_line_assignments
DROP POLICY IF EXISTS "Admins can manage work order line assignments" ON public.work_order_line_assignments;
DROP POLICY IF EXISTS "Users can view work order line assignments in their factory" ON public.work_order_line_assignments;
DROP POLICY IF EXISTS "Factory users can view work order line assignments" ON public.work_order_line_assignments;
DROP POLICY IF EXISTS "Buyers can view line assignments for assigned POs" ON public.work_order_line_assignments;

-- storage_bin_cards
DROP POLICY IF EXISTS "Users can view bin cards in their factory" ON public.storage_bin_cards;
DROP POLICY IF EXISTS "Storage users can create bin cards" ON public.storage_bin_cards;
DROP POLICY IF EXISTS "Users can update bin cards" ON public.storage_bin_cards;
DROP POLICY IF EXISTS "Admins can delete bin cards" ON public.storage_bin_cards;

-- storage_bin_card_transactions
DROP POLICY IF EXISTS "Users can view transactions in their factory" ON public.storage_bin_card_transactions;
DROP POLICY IF EXISTS "Storage users can create transactions" ON public.storage_bin_card_transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON public.storage_bin_card_transactions;
DROP POLICY IF EXISTS "Admins can delete transactions" ON public.storage_bin_card_transactions;

-- cutting_sections
DROP POLICY IF EXISTS "Admins can manage cutting sections" ON public.cutting_sections;
DROP POLICY IF EXISTS "Users can view cutting sections in their factory" ON public.cutting_sections;

-- cutting_targets
DROP POLICY IF EXISTS "Users can view cutting targets in their factory" ON public.cutting_targets;
DROP POLICY IF EXISTS "Factory users can view cutting targets" ON public.cutting_targets;
DROP POLICY IF EXISTS "Buyers can view cutting targets for assigned POs" ON public.cutting_targets;
DROP POLICY IF EXISTS "Cutting users can submit targets" ON public.cutting_targets;
DROP POLICY IF EXISTS "Admins can update cutting targets" ON public.cutting_targets;
DROP POLICY IF EXISTS "Admins can delete cutting targets" ON public.cutting_targets;

-- cutting_actuals
DROP POLICY IF EXISTS "Users can view cutting actuals in their factory" ON public.cutting_actuals;
DROP POLICY IF EXISTS "Factory users can view cutting actuals" ON public.cutting_actuals;
DROP POLICY IF EXISTS "Buyers can view cutting actuals for assigned POs" ON public.cutting_actuals;
DROP POLICY IF EXISTS "Cutting users can submit actuals" ON public.cutting_actuals;
DROP POLICY IF EXISTS "Admins can update cutting actuals" ON public.cutting_actuals;
DROP POLICY IF EXISTS "Admins can delete cutting actuals" ON public.cutting_actuals;
DROP POLICY IF EXISTS "Sewing workers can view cutting handoffs for their lines" ON public.cutting_actuals;
DROP POLICY IF EXISTS "Sewing workers can acknowledge cutting handoffs" ON public.cutting_actuals;

-- finishing_daily_sheets
DROP POLICY IF EXISTS "Users can view sheets in their factory" ON public.finishing_daily_sheets;
DROP POLICY IF EXISTS "Users can create sheets in their factory" ON public.finishing_daily_sheets;
DROP POLICY IF EXISTS "Admins can update sheets" ON public.finishing_daily_sheets;
DROP POLICY IF EXISTS "Admins can delete sheets" ON public.finishing_daily_sheets;

-- finishing_hourly_logs
DROP POLICY IF EXISTS "Users can view hourly logs in their factory" ON public.finishing_hourly_logs;
DROP POLICY IF EXISTS "Users can insert hourly logs" ON public.finishing_hourly_logs;
DROP POLICY IF EXISTS "Admins can update hourly logs" ON public.finishing_hourly_logs;
DROP POLICY IF EXISTS "Workers can update their own unlocked logs" ON public.finishing_hourly_logs;
DROP POLICY IF EXISTS "Admins can delete hourly logs" ON public.finishing_hourly_logs;

-- finishing_daily_logs
DROP POLICY IF EXISTS "Users can view finishing logs in their factory" ON public.finishing_daily_logs;
DROP POLICY IF EXISTS "Factory users can view finishing logs" ON public.finishing_daily_logs;
DROP POLICY IF EXISTS "Buyers can view finishing logs for assigned POs" ON public.finishing_daily_logs;
DROP POLICY IF EXISTS "Users can insert finishing logs in their factory" ON public.finishing_daily_logs;
DROP POLICY IF EXISTS "Users can update their own unlocked logs or admins can update any" ON public.finishing_daily_logs;
DROP POLICY IF EXISTS "Admins can delete finishing daily logs" ON public.finishing_daily_logs;

-- finishing_daily_log_history
DROP POLICY IF EXISTS "Users can view log history in their factory" ON public.finishing_daily_log_history;
DROP POLICY IF EXISTS "Users can insert log history" ON public.finishing_daily_log_history;

-- extras_ledger
DROP POLICY IF EXISTS "Users can view extras ledger for their factory" ON public.extras_ledger;
DROP POLICY IF EXISTS "Factory users can view extras ledger" ON public.extras_ledger;
DROP POLICY IF EXISTS "Buyers can view extras ledger for assigned POs" ON public.extras_ledger;
DROP POLICY IF EXISTS "Users can insert extras ledger for their factory" ON public.extras_ledger;
DROP POLICY IF EXISTS "Admins can update extras ledger for their factory" ON public.extras_ledger;
DROP POLICY IF EXISTS "Admins can delete extras ledger for their factory" ON public.extras_ledger;

-- security_events
DROP POLICY IF EXISTS "Admins can view factory security events" ON public.security_events;
DROP POLICY IF EXISTS "Authenticated users can log security events" ON public.security_events;
DROP POLICY IF EXISTS "Users can log their own security events" ON public.security_events;

-- rate_limits
DROP POLICY IF EXISTS "No public access to rate limits" ON public.rate_limits;

-- knowledge_documents
DROP POLICY IF EXISTS "Users can view knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Users can view global or factory docs" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Admins can manage knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Admins can manage factory docs" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Admins can manage knowledge docs" ON public.knowledge_documents;

-- knowledge_chunks
DROP POLICY IF EXISTS "Users can view knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Users can view chunks of accessible docs" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Admins can insert knowledge chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Admins can delete knowledge chunks" ON public.knowledge_chunks;

-- chat_conversations
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.chat_conversations;

-- chat_messages
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.chat_messages;

-- chat_analytics
DROP POLICY IF EXISTS "Users can insert analytics" ON public.chat_analytics;
DROP POLICY IF EXISTS "Admins can view analytics" ON public.chat_analytics;
DROP POLICY IF EXISTS "Admins can view factory analytics" ON public.chat_analytics;
DROP POLICY IF EXISTS "Users can update own message analytics" ON public.chat_analytics;

-- document_ingestion_queue
DROP POLICY IF EXISTS "Admins can manage ingestion queue" ON public.document_ingestion_queue;
DROP POLICY IF EXISTS "Admins can view ingestion queue" ON public.document_ingestion_queue;
DROP POLICY IF EXISTS "Admins can insert ingestion queue" ON public.document_ingestion_queue;
DROP POLICY IF EXISTS "Admins can update ingestion queue" ON public.document_ingestion_queue;
DROP POLICY IF EXISTS "Admins can delete ingestion queue" ON public.document_ingestion_queue;

-- role_feature_access
DROP POLICY IF EXISTS "Anyone can view role features" ON public.role_feature_access;

-- app_error_logs
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.app_error_logs;
DROP POLICY IF EXISTS "Admins can read error logs" ON public.app_error_logs;
DROP POLICY IF EXISTS "Admins can update error logs" ON public.app_error_logs;
DROP POLICY IF EXISTS "Admins can delete error logs" ON public.app_error_logs;

-- buyer_po_access
DROP POLICY IF EXISTS "Buyers view own PO access" ON public.buyer_po_access;
DROP POLICY IF EXISTS "Admins manage buyer PO access" ON public.buyer_po_access;

-- buyer_factory_memberships
DROP POLICY IF EXISTS "Buyers view own memberships" ON public.buyer_factory_memberships;
DROP POLICY IF EXISTS "Admins manage buyer memberships" ON public.buyer_factory_memberships;

-- buyer_workspace_prefs
DROP POLICY IF EXISTS "Buyers manage own workspace prefs" ON public.buyer_workspace_prefs;

-- form_templates
DROP POLICY IF EXISTS "Users can read form templates for their factory" ON public.form_templates;
DROP POLICY IF EXISTS "Admins can insert form templates" ON public.form_templates;
DROP POLICY IF EXISTS "Admins can update form templates" ON public.form_templates;
DROP POLICY IF EXISTS "Admins can delete form templates" ON public.form_templates;

-- form_sections
DROP POLICY IF EXISTS "Users can read form sections" ON public.form_sections;
DROP POLICY IF EXISTS "Admins can insert form sections" ON public.form_sections;
DROP POLICY IF EXISTS "Admins can update form sections" ON public.form_sections;
DROP POLICY IF EXISTS "Admins can delete form sections" ON public.form_sections;

-- form_fields
DROP POLICY IF EXISTS "Users can read form fields" ON public.form_fields;
DROP POLICY IF EXISTS "Admins can insert form fields" ON public.form_fields;
DROP POLICY IF EXISTS "Admins can update form fields" ON public.form_fields;
DROP POLICY IF EXISTS "Admins can delete form fields" ON public.form_fields;

-- form_role_overrides
DROP POLICY IF EXISTS "Users can read form role overrides" ON public.form_role_overrides;
DROP POLICY IF EXISTS "Admins can insert form role overrides" ON public.form_role_overrides;
DROP POLICY IF EXISTS "Admins can update form role overrides" ON public.form_role_overrides;
DROP POLICY IF EXISTS "Admins can delete form role overrides" ON public.form_role_overrides;

-- custom_dropdown_lists
DROP POLICY IF EXISTS "Users can view their factory dropdown lists" ON public.custom_dropdown_lists;
DROP POLICY IF EXISTS "Admins can manage dropdown lists" ON public.custom_dropdown_lists;
DROP POLICY IF EXISTS "Admins can insert dropdown lists" ON public.custom_dropdown_lists;
DROP POLICY IF EXISTS "Admins can update dropdown lists" ON public.custom_dropdown_lists;
DROP POLICY IF EXISTS "Admins can delete dropdown lists" ON public.custom_dropdown_lists;

-- custom_dropdown_options
DROP POLICY IF EXISTS "Users can view their factory dropdown options" ON public.custom_dropdown_options;
DROP POLICY IF EXISTS "Admins can manage dropdown options" ON public.custom_dropdown_options;
DROP POLICY IF EXISTS "Admins can insert dropdown options" ON public.custom_dropdown_options;
DROP POLICY IF EXISTS "Admins can update dropdown options" ON public.custom_dropdown_options;
DROP POLICY IF EXISTS "Admins can delete dropdown options" ON public.custom_dropdown_options;

-- production_notes
DROP POLICY IF EXISTS "Admins can view factory production notes" ON public.production_notes;
DROP POLICY IF EXISTS "Admins can create production notes" ON public.production_notes;
DROP POLICY IF EXISTS "Admins can update production notes" ON public.production_notes;
DROP POLICY IF EXISTS "Admins can delete production notes" ON public.production_notes;

-- production_note_comments
DROP POLICY IF EXISTS "Admins can view note comments" ON public.production_note_comments;
DROP POLICY IF EXISTS "Admins can add note comments" ON public.production_note_comments;

-- push_tokens
DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Service role reads all tokens" ON public.push_tokens;

-- dispatch_requests
DROP POLICY IF EXISTS "dispatch_requests_factory_isolation" ON public.dispatch_requests;

-- dispatch_daily_sequence
DROP POLICY IF EXISTS "dispatch_daily_sequence_factory_read" ON public.dispatch_daily_sequence;
DROP POLICY IF EXISTS "dispatch_daily_sequence_factory_write" ON public.dispatch_daily_sequence;
DROP POLICY IF EXISTS "dispatch_daily_sequence_factory_access" ON public.dispatch_daily_sequence;
DROP POLICY IF EXISTS "dispatch_daily_sequence_factory_rw" ON public.dispatch_daily_sequence;

-- user_signatures
DROP POLICY IF EXISTS "user_signatures_factory_read" ON public.user_signatures;
DROP POLICY IF EXISTS "user_signatures_own_write" ON public.user_signatures;
DROP POLICY IF EXISTS "user_signatures_own_update" ON public.user_signatures;
DROP POLICY IF EXISTS "user_signatures_own_delete" ON public.user_signatures;

-- invoices
DROP POLICY IF EXISTS "Factory members can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;

-- invoice_line_items
DROP POLICY IF EXISTS "Factory members can view line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Admins can manage line items" ON public.invoice_line_items;

-- invoice_charges
DROP POLICY IF EXISTS "Factory members can view charges" ON public.invoice_charges;
DROP POLICY IF EXISTS "Admins can manage charges" ON public.invoice_charges;
DROP POLICY IF EXISTS "Admins can manage invoice charges" ON public.invoice_charges;
DROP POLICY IF EXISTS "Factory members can view invoice charges" ON public.invoice_charges;

-- invoice_tax_lines
DROP POLICY IF EXISTS "Factory members can view tax lines" ON public.invoice_tax_lines;
DROP POLICY IF EXISTS "Admins can manage tax lines" ON public.invoice_tax_lines;
DROP POLICY IF EXISTS "Admins can manage invoice tax lines" ON public.invoice_tax_lines;
DROP POLICY IF EXISTS "Factory members can view invoice tax lines" ON public.invoice_tax_lines;

-- factory_finance_settings
DROP POLICY IF EXISTS "Factory members can view finance settings" ON public.factory_finance_settings;
DROP POLICY IF EXISTS "Admins can manage finance settings" ON public.factory_finance_settings;

-- factory_bank_accounts
DROP POLICY IF EXISTS "Factory members can view bank accounts" ON public.factory_bank_accounts;
DROP POLICY IF EXISTS "Admins can manage bank accounts" ON public.factory_bank_accounts;


-- ============================================================================
-- SECTION 5: CREATE ALL RLS POLICIES (final state after all migrations)
-- ============================================================================

-- ── factory_accounts ──────────────────────────────────────────────────────────
CREATE POLICY "Users can view their factory basic info" ON public.factory_accounts FOR SELECT TO authenticated
  USING (id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Superadmins can manage all factories" ON public.factory_accounts FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()));
CREATE POLICY "Users without factory can create one" ON public.factory_accounts FOR INSERT TO authenticated
  WITH CHECK (NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.factory_id IS NOT NULL));
CREATE POLICY "Admins can update their factory" ON public.factory_accounts FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND id = get_user_factory_id(auth.uid()));

-- ── profiles ──────────────────────────────────────────────────────────────────
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Supervisors can view all profiles in factory" ON public.profiles FOR SELECT TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid()) AND is_supervisor_or_higher(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Admins can update profiles in their factory" ON public.profiles FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL OR is_superadmin(auth.uid())))
  WITH CHECK (is_admin_or_higher(auth.uid()) AND (factory_id IS NULL OR factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete profiles in their factory" ON public.profiles FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL OR is_superadmin(auth.uid())));

-- ── user_roles ────────────────────────────────────────────────────────────────
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can view factory roles" ON public.user_roles FOR SELECT TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── units ─────────────────────────────────────────────────────────────────────
CREATE POLICY "Users can view units in their factory" ON public.units FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage units" ON public.units FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── floors ────────────────────────────────────────────────────────────────────
CREATE POLICY "Users can view floors in their factory" ON public.floors FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage floors" ON public.floors FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── lines ─────────────────────────────────────────────────────────────────────
CREATE POLICY "Users can view lines in their factory" ON public.lines FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage lines" ON public.lines FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── work_orders ───────────────────────────────────────────────────────────────
CREATE POLICY "Admins can manage work orders" ON public.work_orders FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Supervisors can view work orders" ON public.work_orders FOR SELECT TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid()) AND is_supervisor_or_higher(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Factory users can view work orders" ON public.work_orders FOR SELECT TO authenticated
  USING ((NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Buyers can view assigned work orders" ON public.work_orders FOR SELECT TO authenticated
  USING (is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()) AND EXISTS (SELECT 1 FROM public.buyer_po_access bpa WHERE bpa.work_order_id = work_orders.id AND bpa.user_id = auth.uid()));
CREATE POLICY "Cutting users can view factory work orders" ON public.work_orders FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND has_cutting_role(auth.uid()));
CREATE POLICY "Storage users can view factory work orders" ON public.work_orders FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND has_storage_role(auth.uid()));
CREATE POLICY "Sewing workers can view assigned work orders" ON public.work_orders FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND NOT is_admin_or_higher(auth.uid()) AND NOT has_storage_role(auth.uid()) AND NOT has_cutting_role(auth.uid()) AND (
    EXISTS (SELECT 1 FROM work_order_line_assignments wola JOIN user_line_assignments ula ON ula.line_id = wola.line_id WHERE wola.work_order_id = work_orders.id AND ula.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM sewing_targets WHERE sewing_targets.work_order_id = work_orders.id AND sewing_targets.submitted_by = auth.uid())
    OR EXISTS (SELECT 1 FROM sewing_actuals WHERE sewing_actuals.work_order_id = work_orders.id AND sewing_actuals.submitted_by = auth.uid())
    OR EXISTS (SELECT 1 FROM finishing_targets WHERE finishing_targets.work_order_id = work_orders.id AND finishing_targets.submitted_by = auth.uid())
    OR EXISTS (SELECT 1 FROM finishing_actuals WHERE finishing_actuals.work_order_id = work_orders.id AND finishing_actuals.submitted_by = auth.uid())
  ));

-- ── stages ────────────────────────────────────────────────────────────────────
CREATE POLICY "Users can view stages in their factory" ON public.stages FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage stages" ON public.stages FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── blocker_types ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can view blocker types in their factory" ON public.blocker_types FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage blocker types" ON public.blocker_types FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── production_updates_sewing ─────────────────────────────────────────────────
CREATE POLICY "Users can view sewing updates in their factory" ON public.production_updates_sewing FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Users can submit sewing updates" ON public.production_updates_sewing FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());
CREATE POLICY "Admins can update sewing updates" ON public.production_updates_sewing FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete sewing updates" ON public.production_updates_sewing FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── production_updates_finishing ──────────────────────────────────────────────
CREATE POLICY "Users can view finishing updates in their factory" ON public.production_updates_finishing FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Users can submit finishing updates" ON public.production_updates_finishing FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());
CREATE POLICY "Admins can update finishing updates" ON public.production_updates_finishing FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete finishing updates" ON public.production_updates_finishing FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── daily_insights ────────────────────────────────────────────────────────────
CREATE POLICY "Supervisors can view insights" ON public.daily_insights FOR SELECT TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid()) AND is_supervisor_or_higher(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "System can insert insights" ON public.daily_insights FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()));
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── audit_log ─────────────────────────────────────────────────────────────────
CREATE POLICY "Admins can view audit logs" ON public.audit_log FOR SELECT TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── stage_progress_options ────────────────────────────────────────────────────
CREATE POLICY "Users can view stage_progress_options in their factory" ON public.stage_progress_options FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage stage_progress_options" ON public.stage_progress_options FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── next_milestone_options ────────────────────────────────────────────────────
CREATE POLICY "Users can view next_milestone_options in their factory" ON public.next_milestone_options FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage next_milestone_options" ON public.next_milestone_options FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── blocker_owner_options ─────────────────────────────────────────────────────
CREATE POLICY "Users can view blocker_owner_options in their factory" ON public.blocker_owner_options FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage blocker_owner_options" ON public.blocker_owner_options FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── blocker_impact_options ────────────────────────────────────────────────────
CREATE POLICY "Users can view blocker_impact_options in their factory" ON public.blocker_impact_options FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage blocker_impact_options" ON public.blocker_impact_options FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── email_schedules ───────────────────────────────────────────────────────────
CREATE POLICY "Users can view their own email schedules" ON public.email_schedules FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()));
CREATE POLICY "Users can manage their own email schedules" ON public.email_schedules FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()));

-- ── notification_preferences ──────────────────────────────────────────────────
CREATE POLICY "Users can view their own preferences" ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()));
CREATE POLICY "Users can manage their own preferences" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()));

-- ── user_line_assignments ─────────────────────────────────────────────────────
CREATE POLICY "Admins can manage user line assignments" ON public.user_line_assignments FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Users can view line assignments in their factory" ON public.user_line_assignments FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));

-- ── sewing_targets ────────────────────────────────────────────────────────────
CREATE POLICY "Factory users can view sewing targets" ON public.sewing_targets FOR SELECT TO authenticated
  USING ((NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Buyers can view sewing targets for assigned POs" ON public.sewing_targets FOR SELECT TO authenticated
  USING (is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()) AND EXISTS (SELECT 1 FROM public.buyer_po_access bpa WHERE bpa.work_order_id = sewing_targets.work_order_id AND bpa.user_id = auth.uid()));
CREATE POLICY "Users can submit sewing targets" ON public.sewing_targets FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());
CREATE POLICY "Admins can update sewing targets" ON public.sewing_targets FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete sewing targets" ON public.sewing_targets FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Users can update their own sewing targets" ON public.sewing_targets FOR UPDATE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid())
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());

-- ── sewing_actuals ────────────────────────────────────────────────────────────
CREATE POLICY "Factory users can view sewing actuals" ON public.sewing_actuals FOR SELECT TO authenticated
  USING ((NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Buyers can view sewing actuals for assigned POs" ON public.sewing_actuals FOR SELECT TO authenticated
  USING (is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()) AND EXISTS (SELECT 1 FROM public.buyer_po_access bpa WHERE bpa.work_order_id = sewing_actuals.work_order_id AND bpa.user_id = auth.uid()));
CREATE POLICY "Users can submit sewing actuals" ON public.sewing_actuals FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());
CREATE POLICY "Admins can update sewing actuals" ON public.sewing_actuals FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete sewing actuals" ON public.sewing_actuals FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Users can update their own sewing actuals" ON public.sewing_actuals FOR UPDATE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid())
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());

-- ── finishing_targets ─────────────────────────────────────────────────────────
CREATE POLICY "Factory users can view finishing targets" ON public.finishing_targets FOR SELECT TO authenticated
  USING ((NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Buyers can view finishing targets for assigned POs" ON public.finishing_targets FOR SELECT TO authenticated
  USING (is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()) AND EXISTS (SELECT 1 FROM public.buyer_po_access bpa WHERE bpa.work_order_id = finishing_targets.work_order_id AND bpa.user_id = auth.uid()));
CREATE POLICY "Users can submit finishing targets" ON public.finishing_targets FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());
CREATE POLICY "Admins can update finishing targets" ON public.finishing_targets FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete finishing targets" ON public.finishing_targets FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Users can update their own finishing targets" ON public.finishing_targets FOR UPDATE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid())
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());

-- ── finishing_actuals ─────────────────────────────────────────────────────────
CREATE POLICY "Factory users can view finishing actuals" ON public.finishing_actuals FOR SELECT TO authenticated
  USING ((NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Buyers can view finishing actuals for assigned POs" ON public.finishing_actuals FOR SELECT TO authenticated
  USING (is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()) AND EXISTS (SELECT 1 FROM public.buyer_po_access bpa WHERE bpa.work_order_id = finishing_actuals.work_order_id AND bpa.user_id = auth.uid()));
CREATE POLICY "Users can submit finishing actuals" ON public.finishing_actuals FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());
CREATE POLICY "Admins can update finishing actuals" ON public.finishing_actuals FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete finishing actuals" ON public.finishing_actuals FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Users can update their own finishing actuals" ON public.finishing_actuals FOR UPDATE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid())
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());

-- ── work_order_line_assignments ───────────────────────────────────────────────
CREATE POLICY "Admins can manage work order line assignments" ON public.work_order_line_assignments FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Factory users can view work order line assignments" ON public.work_order_line_assignments FOR SELECT TO authenticated
  USING ((NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Buyers can view line assignments for assigned POs" ON public.work_order_line_assignments FOR SELECT TO authenticated
  USING (is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()) AND EXISTS (SELECT 1 FROM public.buyer_po_access bpa WHERE bpa.work_order_id = work_order_line_assignments.work_order_id AND bpa.user_id = auth.uid()));

-- ── storage_bin_cards ─────────────────────────────────────────────────────────
CREATE POLICY "Users can view bin cards in their factory" ON public.storage_bin_cards FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Storage users can create bin cards" ON public.storage_bin_cards FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND (has_storage_role(auth.uid()) OR is_admin_or_higher(auth.uid())));
CREATE POLICY "Users can update bin cards" ON public.storage_bin_cards FOR UPDATE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND (is_admin_or_higher(auth.uid()) OR (has_storage_role(auth.uid()) AND is_header_locked = false)))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND (is_admin_or_higher(auth.uid()) OR has_storage_role(auth.uid())));
CREATE POLICY "Admins can delete bin cards" ON public.storage_bin_cards FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── storage_bin_card_transactions ─────────────────────────────────────────────
CREATE POLICY "Users can view transactions in their factory" ON public.storage_bin_card_transactions FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Storage users can create transactions" ON public.storage_bin_card_transactions FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid() AND (has_storage_role(auth.uid()) OR is_admin_or_higher(auth.uid())));
CREATE POLICY "Admins can update transactions" ON public.storage_bin_card_transactions FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete transactions" ON public.storage_bin_card_transactions FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── cutting_sections ──────────────────────────────────────────────────────────
CREATE POLICY "Users can view cutting sections in their factory" ON public.cutting_sections FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage cutting sections" ON public.cutting_sections FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── cutting_targets ───────────────────────────────────────────────────────────
CREATE POLICY "Factory users can view cutting targets" ON public.cutting_targets FOR SELECT TO authenticated
  USING ((NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Buyers can view cutting targets for assigned POs" ON public.cutting_targets FOR SELECT TO authenticated
  USING (is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()) AND EXISTS (SELECT 1 FROM public.buyer_po_access bpa WHERE bpa.work_order_id = cutting_targets.work_order_id AND bpa.user_id = auth.uid()));
CREATE POLICY "Cutting users can submit targets" ON public.cutting_targets FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid() AND (has_cutting_role(auth.uid()) OR is_admin_or_higher(auth.uid())));
CREATE POLICY "Admins can update cutting targets" ON public.cutting_targets FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete cutting targets" ON public.cutting_targets FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── cutting_actuals ───────────────────────────────────────────────────────────
CREATE POLICY "Factory users can view cutting actuals" ON public.cutting_actuals FOR SELECT TO authenticated
  USING ((NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Buyers can view cutting actuals for assigned POs" ON public.cutting_actuals FOR SELECT TO authenticated
  USING (is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()) AND EXISTS (SELECT 1 FROM public.buyer_po_access bpa WHERE bpa.work_order_id = cutting_actuals.work_order_id AND bpa.user_id = auth.uid()));
CREATE POLICY "Cutting users can submit actuals" ON public.cutting_actuals FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid() AND (has_cutting_role(auth.uid()) OR is_admin_or_higher(auth.uid())));
CREATE POLICY "Admins can update cutting actuals" ON public.cutting_actuals FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete cutting actuals" ON public.cutting_actuals FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Sewing workers can view cutting handoffs for their lines" ON public.cutting_actuals FOR SELECT TO authenticated
  USING (transfer_to_line_id IN (SELECT line_id FROM public.user_line_assignments WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = auth.uid() WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'owner', 'supervisor', 'superadmin') AND (ur.factory_id = cutting_actuals.factory_id OR ur.factory_id IS NULL))
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'cutting' AND ur.factory_id = cutting_actuals.factory_id)
    OR submitted_by = auth.uid());
CREATE POLICY "Sewing workers can acknowledge cutting handoffs" ON public.cutting_actuals FOR UPDATE TO authenticated
  USING (transfer_to_line_id IN (SELECT line_id FROM public.user_line_assignments WHERE user_id = auth.uid()))
  WITH CHECK (transfer_to_line_id IN (SELECT line_id FROM public.user_line_assignments WHERE user_id = auth.uid()));

-- ── finishing_daily_sheets ────────────────────────────────────────────────────
CREATE POLICY "Users can view sheets in their factory" ON public.finishing_daily_sheets FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Users can create sheets in their factory" ON public.finishing_daily_sheets FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Admins can update sheets" ON public.finishing_daily_sheets FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete sheets" ON public.finishing_daily_sheets FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── finishing_hourly_logs ─────────────────────────────────────────────────────
CREATE POLICY "Users can view hourly logs in their factory" ON public.finishing_hourly_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.finishing_daily_sheets s WHERE s.id = sheet_id AND (s.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Users can insert hourly logs" ON public.finishing_hourly_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.finishing_daily_sheets s WHERE s.id = sheet_id AND s.factory_id = get_user_factory_id(auth.uid())) AND submitted_by = auth.uid());
CREATE POLICY "Admins can update hourly logs" ON public.finishing_hourly_logs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.finishing_daily_sheets s WHERE s.id = sheet_id AND is_admin_or_higher(auth.uid()) AND (s.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Workers can update their own unlocked logs" ON public.finishing_hourly_logs FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND is_locked = false AND EXISTS (SELECT 1 FROM public.finishing_daily_sheets s WHERE s.id = sheet_id AND s.factory_id = get_user_factory_id(auth.uid())));
CREATE POLICY "Admins can delete hourly logs" ON public.finishing_hourly_logs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.finishing_daily_sheets s WHERE s.id = sheet_id AND is_admin_or_higher(auth.uid()) AND (s.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));

-- ── finishing_daily_logs ──────────────────────────────────────────────────────
CREATE POLICY "Factory users can view finishing logs" ON public.finishing_daily_logs FOR SELECT TO authenticated
  USING (NOT is_buyer_role(auth.uid()) AND factory_id IN (SELECT factory_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Buyers can view finishing logs for assigned POs" ON public.finishing_daily_logs FOR SELECT TO authenticated
  USING (is_buyer_role(auth.uid()) AND factory_id IN (SELECT factory_id FROM public.profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM public.buyer_po_access bpa WHERE bpa.work_order_id = finishing_daily_logs.work_order_id AND bpa.user_id = auth.uid()));
CREATE POLICY "Users can insert finishing logs in their factory" ON public.finishing_daily_logs FOR INSERT TO authenticated
  WITH CHECK (factory_id IN (SELECT factory_id FROM public.profiles WHERE id = auth.uid()) AND submitted_by = auth.uid());
CREATE POLICY "Users can update their own unlocked logs or admins can update any" ON public.finishing_daily_logs FOR UPDATE TO authenticated
  USING (factory_id IN (SELECT factory_id FROM public.profiles WHERE id = auth.uid()) AND ((submitted_by = auth.uid() AND is_locked = FALSE) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor')));
CREATE POLICY "Admins can delete finishing daily logs" ON public.finishing_daily_logs FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── finishing_daily_log_history ────────────────────────────────────────────────
CREATE POLICY "Users can view log history in their factory" ON public.finishing_daily_log_history FOR SELECT TO authenticated
  USING (log_id IN (SELECT id FROM public.finishing_daily_logs WHERE factory_id IN (SELECT factory_id FROM public.profiles WHERE id = auth.uid())));
CREATE POLICY "Users can insert log history" ON public.finishing_daily_log_history FOR INSERT TO authenticated
  WITH CHECK (log_id IN (SELECT id FROM public.finishing_daily_logs WHERE factory_id IN (SELECT factory_id FROM public.profiles WHERE id = auth.uid())));

-- ── extras_ledger ─────────────────────────────────────────────────────────────
CREATE POLICY "Factory users can view extras ledger" ON public.extras_ledger FOR SELECT TO authenticated
  USING ((NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Buyers can view extras ledger for assigned POs" ON public.extras_ledger FOR SELECT TO authenticated
  USING (is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()) AND EXISTS (SELECT 1 FROM public.buyer_po_access bpa WHERE bpa.work_order_id = extras_ledger.work_order_id AND bpa.user_id = auth.uid()));
CREATE POLICY "Users can insert extras ledger for their factory" ON public.extras_ledger FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Admins can update extras ledger for their factory" ON public.extras_ledger FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete extras ledger for their factory" ON public.extras_ledger FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── security_events ───────────────────────────────────────────────────────────
CREATE POLICY "Admins can view factory security events" ON public.security_events FOR SELECT TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Users can log their own security events" ON public.security_events FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid() OR user_id IS NULL) AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL));

-- ── rate_limits ───────────────────────────────────────────────────────────────
CREATE POLICY "No public access to rate limits" ON public.rate_limits FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- ── knowledge_documents ───────────────────────────────────────────────────────
CREATE POLICY "Users can view global or factory docs" ON public.knowledge_documents FOR SELECT TO authenticated
  USING (is_global = true OR factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can manage knowledge docs" ON public.knowledge_documents FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL OR is_superadmin(auth.uid())))
  WITH CHECK (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL OR is_superadmin(auth.uid())));

-- ── knowledge_chunks ──────────────────────────────────────────────────────────
CREATE POLICY "Users can view chunks of accessible docs" ON public.knowledge_chunks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.id = knowledge_chunks.document_id AND (d.is_global = true OR d.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can insert knowledge chunks" ON public.knowledge_chunks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.id = knowledge_chunks.document_id AND is_admin_or_higher(auth.uid()) AND (d.factory_id = get_user_factory_id(auth.uid()) OR d.is_global = true OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can delete knowledge chunks" ON public.knowledge_chunks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.id = knowledge_chunks.document_id AND is_admin_or_higher(auth.uid()) AND (d.factory_id = get_user_factory_id(auth.uid()) OR d.is_global = true OR is_superadmin(auth.uid()))));

-- ── chat_conversations ────────────────────────────────────────────────────────
CREATE POLICY "Users can view own conversations" ON public.chat_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()));
CREATE POLICY "Users can create conversations" ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own conversations" ON public.chat_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ── chat_messages ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can view messages in own conversations" ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = chat_messages.conversation_id AND (c.user_id = auth.uid() OR is_superadmin(auth.uid()))));
CREATE POLICY "Users can insert messages in own conversations" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()));

-- ── chat_analytics ────────────────────────────────────────────────────────────
CREATE POLICY "Admins can view factory analytics" ON public.chat_analytics FOR SELECT TO authenticated
  USING ((factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid())) OR is_superadmin(auth.uid()));
CREATE POLICY "Users can insert analytics" ON public.chat_analytics FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Users can update own message analytics" ON public.chat_analytics FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_messages m JOIN public.chat_conversations c ON c.id = m.conversation_id WHERE m.id = chat_analytics.message_id AND c.user_id = auth.uid()));

-- ── document_ingestion_queue ──────────────────────────────────────────────────
CREATE POLICY "Admins can view ingestion queue" ON public.document_ingestion_queue FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.id = document_ingestion_queue.document_id AND (is_admin_or_higher(auth.uid()) AND (d.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())))));
CREATE POLICY "Admins can insert ingestion queue" ON public.document_ingestion_queue FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update ingestion queue" ON public.document_ingestion_queue FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can delete ingestion queue" ON public.document_ingestion_queue FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()));

-- ── role_feature_access ───────────────────────────────────────────────────────
CREATE POLICY "Anyone can view role features" ON public.role_feature_access FOR SELECT TO authenticated
  USING (true);

-- ── app_error_logs ────────────────────────────────────────────────────────────
CREATE POLICY "Anyone can insert error logs" ON public.app_error_logs FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Admins can read error logs" ON public.app_error_logs FOR SELECT TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL));
CREATE POLICY "Admins can update error logs" ON public.app_error_logs FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL));
CREATE POLICY "Admins can delete error logs" ON public.app_error_logs FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL));

-- ── buyer_po_access ───────────────────────────────────────────────────────────
CREATE POLICY "Buyers view own PO access" ON public.buyer_po_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins manage buyer PO access" ON public.buyer_po_access FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()));

-- ── buyer_factory_memberships ─────────────────────────────────────────────────
CREATE POLICY "Buyers view own memberships" ON public.buyer_factory_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins manage buyer memberships" ON public.buyer_factory_memberships FOR ALL TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()));

-- ── buyer_workspace_prefs ─────────────────────────────────────────────────────
CREATE POLICY "Buyers manage own workspace prefs" ON public.buyer_workspace_prefs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── form_templates ────────────────────────────────────────────────────────────
CREATE POLICY "Users can read form templates for their factory" ON public.form_templates FOR SELECT TO authenticated
  USING (factory_id IS NULL OR factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));
CREATE POLICY "Admins can insert form templates" ON public.form_templates FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can update form templates" ON public.form_templates FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete form templates" ON public.form_templates FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── form_sections ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can read form sections" ON public.form_sections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_sections.template_id AND (ft.factory_id IS NULL OR ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can insert form sections" ON public.form_sections FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_sections.template_id AND is_admin_or_higher(auth.uid()) AND (ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can update form sections" ON public.form_sections FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_sections.template_id AND is_admin_or_higher(auth.uid()) AND (ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can delete form sections" ON public.form_sections FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_sections.template_id AND is_admin_or_higher(auth.uid()) AND (ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));

-- ── form_fields ───────────────────────────────────────────────────────────────
CREATE POLICY "Users can read form fields" ON public.form_fields FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_fields.template_id AND (ft.factory_id IS NULL OR ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can insert form fields" ON public.form_fields FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_fields.template_id AND is_admin_or_higher(auth.uid()) AND (ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can update form fields" ON public.form_fields FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_fields.template_id AND is_admin_or_higher(auth.uid()) AND (ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can delete form fields" ON public.form_fields FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_fields.template_id AND is_admin_or_higher(auth.uid()) AND (ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));

-- ── form_role_overrides ───────────────────────────────────────────────────────
CREATE POLICY "Users can read form role overrides" ON public.form_role_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_role_overrides.template_id AND (ft.factory_id IS NULL OR ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can insert form role overrides" ON public.form_role_overrides FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_role_overrides.template_id AND is_admin_or_higher(auth.uid()) AND (ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can update form role overrides" ON public.form_role_overrides FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_role_overrides.template_id AND is_admin_or_higher(auth.uid()) AND (ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can delete form role overrides" ON public.form_role_overrides FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_role_overrides.template_id AND is_admin_or_higher(auth.uid()) AND (ft.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));

-- ── custom_dropdown_lists ─────────────────────────────────────────────────────
CREATE POLICY "Users can view their factory dropdown lists" ON public.custom_dropdown_lists FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()));
CREATE POLICY "Admins can insert dropdown lists" ON public.custom_dropdown_lists FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update dropdown lists" ON public.custom_dropdown_lists FOR UPDATE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can delete dropdown lists" ON public.custom_dropdown_lists FOR DELETE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));

-- ── custom_dropdown_options ───────────────────────────────────────────────────
CREATE POLICY "Users can view their factory dropdown options" ON public.custom_dropdown_options FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()));
CREATE POLICY "Admins can insert dropdown options" ON public.custom_dropdown_options FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update dropdown options" ON public.custom_dropdown_options FOR UPDATE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can delete dropdown options" ON public.custom_dropdown_options FOR DELETE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));

-- ── production_notes ──────────────────────────────────────────────────────────
CREATE POLICY "Admins can view factory production notes" ON public.production_notes FOR SELECT TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can create production notes" ON public.production_notes FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can update production notes" ON public.production_notes FOR UPDATE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
CREATE POLICY "Admins can delete production notes" ON public.production_notes FOR DELETE TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ── production_note_comments ──────────────────────────────────────────────────
CREATE POLICY "Admins can view note comments" ON public.production_note_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.production_notes pn WHERE pn.id = production_note_comments.note_id AND is_admin_or_higher(auth.uid()) AND (pn.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));
CREATE POLICY "Admins can add note comments" ON public.production_note_comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.production_notes pn WHERE pn.id = production_note_comments.note_id AND is_admin_or_higher(auth.uid()) AND (pn.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))));

-- ── push_tokens ───────────────────────────────────────────────────────────────
CREATE POLICY "Users manage own push tokens" ON public.push_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── dispatch_requests ─────────────────────────────────────────────────────────
CREATE POLICY "dispatch_requests_factory_isolation" ON public.dispatch_requests FOR ALL TO authenticated
  USING (factory_id IN (SELECT factory_id FROM profiles WHERE id = auth.uid()));

-- ── dispatch_daily_sequence ───────────────────────────────────────────────────
CREATE POLICY "dispatch_daily_sequence_factory_rw" ON public.dispatch_daily_sequence FOR ALL TO authenticated
  USING (factory_id IN (SELECT factory_id FROM profiles WHERE id = auth.uid()));

-- ── user_signatures ───────────────────────────────────────────────────────────
CREATE POLICY "user_signatures_factory_read" ON public.user_signatures FOR SELECT TO authenticated
  USING (factory_id IN (SELECT factory_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "user_signatures_own_write" ON public.user_signatures FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_signatures_own_update" ON public.user_signatures FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "user_signatures_own_delete" ON public.user_signatures FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── invoices ──────────────────────────────────────────────────────────────────
CREATE POLICY "Factory members can view invoices" ON public.invoices FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()));
CREATE POLICY "Admins can insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));

-- ── invoice_line_items ────────────────────────────────────────────────────────
CREATE POLICY "Factory members can view line items" ON public.invoice_line_items FOR SELECT TO authenticated
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));
CREATE POLICY "Admins can manage line items" ON public.invoice_line_items FOR ALL TO authenticated
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())))
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));

-- ── invoice_charges ───────────────────────────────────────────────────────────
CREATE POLICY "Factory members can view charges" ON public.invoice_charges FOR SELECT TO authenticated
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));
CREATE POLICY "Admins can manage charges" ON public.invoice_charges FOR ALL TO authenticated
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())))
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));

-- ── invoice_tax_lines ─────────────────────────────────────────────────────────
CREATE POLICY "Factory members can view tax lines" ON public.invoice_tax_lines FOR SELECT TO authenticated
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));
CREATE POLICY "Admins can manage tax lines" ON public.invoice_tax_lines FOR ALL TO authenticated
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));

-- ── factory_finance_settings ──────────────────────────────────────────────────
CREATE POLICY "Factory members can view finance settings" ON public.factory_finance_settings FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()));
CREATE POLICY "Admins can manage finance settings" ON public.factory_finance_settings FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));

-- ── factory_bank_accounts ─────────────────────────────────────────────────────
CREATE POLICY "Admins can view bank accounts" ON public.factory_bank_accounts FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));
CREATE POLICY "Admins can manage bank accounts" ON public.factory_bank_accounts FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));


-- ============================================================================
-- SECTION 6: CREATE ALL TRIGGERS
-- ============================================================================

-- updated_at triggers
DROP TRIGGER IF EXISTS update_factory_accounts_updated_at ON public.factory_accounts;
CREATE TRIGGER update_factory_accounts_updated_at BEFORE UPDATE ON public.factory_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_units_updated_at ON public.units;
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_floors_updated_at ON public.floors;
CREATE TRIGGER update_floors_updated_at BEFORE UPDATE ON public.floors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_lines_updated_at ON public.lines;
CREATE TRIGGER update_lines_updated_at BEFORE UPDATE ON public.lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_orders_updated_at ON public.work_orders;
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_storage_bin_cards_updated_at ON public.storage_bin_cards;
CREATE TRIGGER update_storage_bin_cards_updated_at BEFORE UPDATE ON public.storage_bin_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_schedules_updated_at ON public.email_schedules;
CREATE TRIGGER update_email_schedules_updated_at BEFORE UPDATE ON public.email_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_finishing_daily_sheets_updated_at ON public.finishing_daily_sheets;
CREATE TRIGGER update_finishing_daily_sheets_updated_at BEFORE UPDATE ON public.finishing_daily_sheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_knowledge_documents_updated_at ON public.knowledge_documents;
CREATE TRIGGER update_knowledge_documents_updated_at BEFORE UPDATE ON public.knowledge_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS production_notes_updated_at ON public.production_notes;
CREATE TRIGGER production_notes_updated_at BEFORE UPDATE ON public.production_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS dispatch_requests_updated_at ON public.dispatch_requests;
CREATE TRIGGER dispatch_requests_updated_at BEFORE UPDATE ON public.dispatch_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS user_signatures_updated_at ON public.user_signatures;
CREATE TRIGGER user_signatures_updated_at BEFORE UPDATE ON public.user_signatures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_invoices_updated_at();

DROP TRIGGER IF EXISTS factory_finance_settings_updated_at ON public.factory_finance_settings;
CREATE TRIGGER factory_finance_settings_updated_at BEFORE UPDATE ON public.factory_finance_settings FOR EACH ROW EXECUTE FUNCTION public.update_factory_finance_settings_updated_at();

-- handle_new_user trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- enforce_line_activation_limit trigger
DROP TRIGGER IF EXISTS enforce_line_activation_limit_trigger ON public.lines;
CREATE TRIGGER enforce_line_activation_limit_trigger BEFORE INSERT OR UPDATE ON public.lines FOR EACH ROW EXECUTE FUNCTION public.enforce_line_activation_limit();

-- prevent_work_order_hard_delete trigger
DROP TRIGGER IF EXISTS prevent_work_order_hard_delete ON public.work_orders;
CREATE TRIGGER prevent_work_order_hard_delete BEFORE DELETE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.prevent_work_order_delete();

-- validate_dispatch_requests trigger
DROP TRIGGER IF EXISTS validate_dispatch_requests ON public.dispatch_requests;
CREATE TRIGGER validate_dispatch_requests BEFORE INSERT OR UPDATE ON public.dispatch_requests FOR EACH ROW EXECUTE FUNCTION public.validate_dispatch_quantity();

-- Notification triggers: low_efficiency
DROP TRIGGER IF EXISTS trigger_notify_low_efficiency_sewing ON public.production_updates_sewing;
CREATE TRIGGER trigger_notify_low_efficiency_sewing AFTER INSERT ON public.production_updates_sewing FOR EACH ROW EXECUTE FUNCTION public.notify_low_efficiency();

DROP TRIGGER IF EXISTS trigger_notify_low_efficiency_finishing ON public.production_updates_finishing;
CREATE TRIGGER trigger_notify_low_efficiency_finishing AFTER INSERT ON public.production_updates_finishing FOR EACH ROW EXECUTE FUNCTION public.notify_low_efficiency();

DROP TRIGGER IF EXISTS trigger_notify_low_efficiency_sewing_actuals ON public.sewing_actuals;
CREATE TRIGGER trigger_notify_low_efficiency_sewing_actuals AFTER INSERT ON public.sewing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_low_efficiency();

DROP TRIGGER IF EXISTS trigger_notify_low_efficiency_finishing_actuals ON public.finishing_actuals;
CREATE TRIGGER trigger_notify_low_efficiency_finishing_actuals AFTER INSERT ON public.finishing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_low_efficiency();

-- Notification triggers: critical_blocker
DROP TRIGGER IF EXISTS trigger_notify_critical_blocker_sewing ON public.production_updates_sewing;
CREATE TRIGGER trigger_notify_critical_blocker_sewing AFTER INSERT ON public.production_updates_sewing FOR EACH ROW EXECUTE FUNCTION public.notify_critical_blocker();

DROP TRIGGER IF EXISTS trigger_notify_critical_blocker_finishing ON public.production_updates_finishing;
CREATE TRIGGER trigger_notify_critical_blocker_finishing AFTER INSERT ON public.production_updates_finishing FOR EACH ROW EXECUTE FUNCTION public.notify_critical_blocker();

DROP TRIGGER IF EXISTS trigger_notify_critical_blocker_sewing_actuals ON public.sewing_actuals;
CREATE TRIGGER trigger_notify_critical_blocker_sewing_actuals AFTER INSERT ON public.sewing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_critical_blocker();

DROP TRIGGER IF EXISTS trigger_notify_critical_blocker_finishing_actuals ON public.finishing_actuals;
CREATE TRIGGER trigger_notify_critical_blocker_finishing_actuals AFTER INSERT ON public.finishing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_critical_blocker();

-- Notification triggers: blocker_on_my_line
DROP TRIGGER IF EXISTS trigger_notify_blocker_on_my_line ON public.sewing_actuals;
CREATE TRIGGER trigger_notify_blocker_on_my_line AFTER INSERT ON public.sewing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_blocker_on_my_line();

DROP TRIGGER IF EXISTS trigger_notify_blocker_on_my_line ON public.finishing_actuals;
CREATE TRIGGER trigger_notify_blocker_on_my_line AFTER INSERT ON public.finishing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_blocker_on_my_line();

DROP TRIGGER IF EXISTS trigger_notify_blocker_on_my_line ON public.production_updates_sewing;
CREATE TRIGGER trigger_notify_blocker_on_my_line AFTER INSERT ON public.production_updates_sewing FOR EACH ROW EXECUTE FUNCTION public.notify_blocker_on_my_line();

DROP TRIGGER IF EXISTS trigger_notify_blocker_on_my_line ON public.production_updates_finishing;
CREATE TRIGGER trigger_notify_blocker_on_my_line AFTER INSERT ON public.production_updates_finishing FOR EACH ROW EXECUTE FUNCTION public.notify_blocker_on_my_line();

-- Notification triggers: target_achieved
DROP TRIGGER IF EXISTS trigger_notify_target_achieved_sewing ON public.sewing_actuals;
CREATE TRIGGER trigger_notify_target_achieved_sewing AFTER INSERT ON public.sewing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_target_achieved();

DROP TRIGGER IF EXISTS trigger_notify_target_achieved_finishing ON public.finishing_actuals;
CREATE TRIGGER trigger_notify_target_achieved_finishing AFTER INSERT ON public.finishing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_target_achieved();

-- Notification triggers: blocker_resolved
DROP TRIGGER IF EXISTS trigger_notify_blocker_resolved_sewing ON public.sewing_actuals;
CREATE TRIGGER trigger_notify_blocker_resolved_sewing AFTER UPDATE ON public.sewing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_blocker_resolved();

DROP TRIGGER IF EXISTS trigger_notify_blocker_resolved_finishing ON public.finishing_actuals;
CREATE TRIGGER trigger_notify_blocker_resolved_finishing AFTER UPDATE ON public.finishing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_blocker_resolved();

DROP TRIGGER IF EXISTS trigger_notify_blocker_resolved_prod_sewing ON public.production_updates_sewing;
CREATE TRIGGER trigger_notify_blocker_resolved_prod_sewing AFTER UPDATE ON public.production_updates_sewing FOR EACH ROW EXECUTE FUNCTION public.notify_blocker_resolved();

DROP TRIGGER IF EXISTS trigger_notify_blocker_resolved_prod_finishing ON public.production_updates_finishing;
CREATE TRIGGER trigger_notify_blocker_resolved_prod_finishing AFTER UPDATE ON public.production_updates_finishing FOR EACH ROW EXECUTE FUNCTION public.notify_blocker_resolved();

-- Notification triggers: production_notes
DROP TRIGGER IF EXISTS trigger_notify_production_notes_sewing ON public.sewing_actuals;
CREATE TRIGGER trigger_notify_production_notes_sewing AFTER INSERT OR UPDATE ON public.sewing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_production_notes();

DROP TRIGGER IF EXISTS trigger_notify_production_notes_finishing ON public.finishing_actuals;
CREATE TRIGGER trigger_notify_production_notes_finishing AFTER INSERT OR UPDATE ON public.finishing_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_production_notes();

DROP TRIGGER IF EXISTS trigger_notify_production_notes_prod_sewing ON public.production_updates_sewing;
CREATE TRIGGER trigger_notify_production_notes_prod_sewing AFTER INSERT OR UPDATE ON public.production_updates_sewing FOR EACH ROW EXECUTE FUNCTION public.notify_production_notes();

DROP TRIGGER IF EXISTS trigger_notify_production_notes_prod_finishing ON public.production_updates_finishing;
CREATE TRIGGER trigger_notify_production_notes_prod_finishing AFTER INSERT OR UPDATE ON public.production_updates_finishing FOR EACH ROW EXECUTE FUNCTION public.notify_production_notes();

-- Notification triggers: cutting_handoff
DROP TRIGGER IF EXISTS trigger_notify_sewing_on_cutting_actual ON public.cutting_actuals;
CREATE TRIGGER trigger_notify_sewing_on_cutting_actual AFTER INSERT ON public.cutting_actuals FOR EACH ROW EXECUTE FUNCTION public.notify_sewing_on_cutting_actual();

-- Notification triggers: work_order_update
DROP TRIGGER IF EXISTS trigger_notify_work_order_update ON public.work_orders;
CREATE TRIGGER trigger_notify_work_order_update AFTER UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.notify_work_order_update();

-- Notification triggers: push notification
DROP TRIGGER IF EXISTS on_notification_inserted ON public.notifications;
CREATE TRIGGER on_notification_inserted AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_insert();


-- ============================================================================
-- SECTION 7: STORAGE BUCKET POLICIES (on storage.objects)
-- ============================================================================

-- Cutting leftover photos
DROP POLICY IF EXISTS "Anyone can view cutting leftover photos" ON storage.objects;
CREATE POLICY "Anyone can view cutting leftover photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'cutting-leftover-photos');

DROP POLICY IF EXISTS "Cutting users can upload leftover photos" ON storage.objects;
CREATE POLICY "Cutting users can upload leftover photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cutting-leftover-photos' AND auth.uid() IS NOT NULL AND (public.has_cutting_role(auth.uid()) OR public.is_admin_or_higher(auth.uid())));

DROP POLICY IF EXISTS "Cutting users can delete their leftover photos" ON storage.objects;
CREATE POLICY "Cutting users can delete their leftover photos" ON storage.objects FOR DELETE
  USING (bucket_id = 'cutting-leftover-photos' AND auth.uid() IS NOT NULL AND (public.has_cutting_role(auth.uid()) OR public.is_admin_or_higher(auth.uid())));

-- Signatures bucket
DROP POLICY IF EXISTS "signatures_read" ON storage.objects;
DROP POLICY IF EXISTS "signatures_factory_read" ON storage.objects;
DROP POLICY IF EXISTS "signatures_select" ON storage.objects;
CREATE POLICY "signatures_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'signatures');

DROP POLICY IF EXISTS "signatures_insert" ON storage.objects;
DROP POLICY IF EXISTS "signatures_own_upload" ON storage.objects;
CREATE POLICY "signatures_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "signatures_update" ON storage.objects;
CREATE POLICY "signatures_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signatures' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "signatures_delete" ON storage.objects;
CREATE POLICY "signatures_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Dispatch photos bucket
DROP POLICY IF EXISTS "dispatch_photos_factory" ON storage.objects;
DROP POLICY IF EXISTS "dispatch_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "dispatch_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "Dispatch photos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload dispatch photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update dispatch photos" ON storage.objects;

CREATE POLICY "Dispatch photos are publicly readable" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'dispatch-photos');
CREATE POLICY "Authenticated users can upload dispatch photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dispatch-photos');
CREATE POLICY "Authenticated users can update dispatch photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dispatch-photos');

-- Gate passes bucket
DROP POLICY IF EXISTS "gate_passes_factory" ON storage.objects;
DROP POLICY IF EXISTS "gate_passes_select" ON storage.objects;
DROP POLICY IF EXISTS "gate_passes_insert" ON storage.objects;
DROP POLICY IF EXISTS "Factory members can upload gate passes" ON storage.objects;
DROP POLICY IF EXISTS "Gate passes are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Factory members can update gate passes" ON storage.objects;

CREATE POLICY "Gate passes are publicly readable" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'gate-passes');
CREATE POLICY "Factory members can upload gate passes" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gate-passes');
CREATE POLICY "Factory members can update gate passes" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gate-passes');


-- ============================================================================
-- DONE. All functions, RLS policies, and triggers are now applied.
-- ============================================================================
NOTIFY pgrst, 'reload schema';
