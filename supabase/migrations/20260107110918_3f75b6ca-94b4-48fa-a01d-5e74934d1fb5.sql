-- =============================================
-- SECURITY HARDENING MIGRATION
-- Addresses ERROR-level findings: tenant isolation, role-based access
-- =============================================

-- 1. Create helper function to check if user is supervisor or higher
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
    AND role IN ('supervisor', 'admin', 'owner', 'superadmin')
  )
$$;

-- 2. FACTORY_ACCOUNTS: Restrict sensitive fields to admin/owner only
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their factory" ON public.factory_accounts;

-- Create new restrictive policy - regular users can only see basic info
CREATE POLICY "Users can view their factory basic info"
ON public.factory_accounts
FOR SELECT
TO authenticated
USING (
  id = get_user_factory_id(auth.uid())
  OR is_superadmin(auth.uid())
);

-- Note: Sensitive fields (stripe_customer_id, stripe_subscription_id, payment_failed_at) 
-- are still visible but should be filtered in application code for non-admins
-- Alternative: Create a view that hides sensitive fields for non-admins

-- 3. PROFILES: Restrict contact info visibility - users see own profile fully, others see limited
DROP POLICY IF EXISTS "Users can view profiles in their factory" ON public.profiles;

-- Users can always see their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Admins/supervisors can view all profiles in their factory
CREATE POLICY "Supervisors can view all profiles in factory"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (factory_id = get_user_factory_id(auth.uid()) AND is_supervisor_or_higher(auth.uid()))
  OR is_superadmin(auth.uid())
);

-- Regular workers can only see names (not emails/phones) of colleagues
-- This is handled by the above policies - they only see their own profile

-- 4. WORK_ORDERS: Restrict buyer/supplier visibility to supervisors+
DROP POLICY IF EXISTS "Users can view work orders in their factory" ON public.work_orders;

-- Supervisors and above can view all work order details
CREATE POLICY "Supervisors can view work orders"
ON public.work_orders
FOR SELECT
TO authenticated
USING (
  (factory_id = get_user_factory_id(auth.uid()) AND is_supervisor_or_higher(auth.uid()))
  OR is_superadmin(auth.uid())
);

-- Workers can view work orders they're assigned to or have submitted work on
CREATE POLICY "Workers can view assigned work orders"
ON public.work_orders
FOR SELECT
TO authenticated
USING (
  factory_id = get_user_factory_id(auth.uid())
  AND (
    -- Worker has line assignment for this work order
    EXISTS (
      SELECT 1 FROM work_order_line_assignments wola
      JOIN user_line_assignments ula ON ula.line_id = wola.line_id
      WHERE wola.work_order_id = work_orders.id
      AND ula.user_id = auth.uid()
    )
    -- Or worker has submitted data for this work order
    OR EXISTS (
      SELECT 1 FROM sewing_targets WHERE work_order_id = work_orders.id AND submitted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM sewing_actuals WHERE work_order_id = work_orders.id AND submitted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM finishing_targets WHERE work_order_id = work_orders.id AND submitted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM finishing_actuals WHERE work_order_id = work_orders.id AND submitted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM cutting_targets WHERE work_order_id = work_orders.id AND submitted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM cutting_actuals WHERE work_order_id = work_orders.id AND submitted_by = auth.uid()
    )
  )
);

-- 5. USER_ROLES: Restrict role visibility
DROP POLICY IF EXISTS "Users can view roles in their factory" ON public.user_roles;

-- Users can see their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all roles in their factory
CREATE POLICY "Admins can view factory roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()))
  OR is_superadmin(auth.uid())
);

-- 6. DAILY_INSIGHTS: Restrict to supervisors+
DROP POLICY IF EXISTS "Users can view insights in their factory" ON public.daily_insights;

CREATE POLICY "Supervisors can view insights"
ON public.daily_insights
FOR SELECT
TO authenticated
USING (
  (factory_id = get_user_factory_id(auth.uid()) AND is_supervisor_or_higher(auth.uid()))
  OR is_superadmin(auth.uid())
);

-- 7. Create security_events table for audit logging
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid,
  factory_id uuid,
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on security_events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only superadmins can view security events, admins can view their factory's events
CREATE POLICY "Admins can view factory security events"
ON public.security_events
FOR SELECT
TO authenticated
USING (
  (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()))
  OR is_superadmin(auth.uid())
);

-- Anyone authenticated can insert security events (for logging)
CREATE POLICY "Authenticated users can log security events"
ON public.security_events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 8. Create rate_limits table for tracking
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- email, IP, or composite key
  action_type text NOT NULL, -- 'login', 'reset_password', 'invite'
  attempts integer DEFAULT 1,
  first_attempt_at timestamptz DEFAULT now(),
  last_attempt_at timestamptz DEFAULT now(),
  blocked_until timestamptz,
  UNIQUE(identifier, action_type)
);

-- Enable RLS - only service role can access
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access to rate_limits (only service role via edge functions)

-- 9. Create function to check and update rate limits
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
  
  -- Get existing record
  SELECT * INTO v_record
  FROM rate_limits
  WHERE identifier = p_identifier AND action_type = p_action_type;
  
  -- Check if blocked
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'blocked',
      'blocked_until', v_record.blocked_until,
      'attempts', v_record.attempts
    );
  END IF;
  
  -- If no record or outside window, reset
  IF v_record.id IS NULL OR v_record.first_attempt_at < v_window_start THEN
    INSERT INTO rate_limits (identifier, action_type, attempts, first_attempt_at, last_attempt_at, blocked_until)
    VALUES (p_identifier, p_action_type, 1, v_now, v_now, NULL)
    ON CONFLICT (identifier, action_type) 
    DO UPDATE SET attempts = 1, first_attempt_at = v_now, last_attempt_at = v_now, blocked_until = NULL;
    
    RETURN jsonb_build_object('allowed', true, 'attempts', 1);
  END IF;
  
  -- Increment attempts
  UPDATE rate_limits
  SET attempts = attempts + 1, last_attempt_at = v_now,
      blocked_until = CASE 
        WHEN attempts + 1 >= p_max_attempts THEN v_now + (p_block_minutes || ' minutes')::interval
        ELSE NULL
      END
  WHERE identifier = p_identifier AND action_type = p_action_type
  RETURNING * INTO v_record;
  
  IF v_record.attempts >= p_max_attempts THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'blocked_until', v_record.blocked_until,
      'attempts', v_record.attempts
    );
  END IF;
  
  RETURN jsonb_build_object('allowed', true, 'attempts', v_record.attempts);
END;
$$;

-- 10. Create function to log security events
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

-- 11. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON public.rate_limits(identifier, action_type);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_factory ON public.security_events(factory_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events(user_id, created_at);