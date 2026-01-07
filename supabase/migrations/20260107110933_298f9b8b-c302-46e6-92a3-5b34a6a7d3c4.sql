-- Fix linter warnings: RLS policies

-- 1. Fix the "always true" INSERT policy on security_events
DROP POLICY IF EXISTS "Authenticated users can log security events" ON public.security_events;

-- Only allow logging events for the user's own factory or their own user_id
CREATE POLICY "Users can log their own security events"
ON public.security_events
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid() OR user_id IS NULL)
  AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL)
);

-- 2. Add policy to rate_limits so it's not flagged as "no policy"
-- Only service role should access this, but we need at least one policy
CREATE POLICY "No public access to rate limits"
ON public.rate_limits
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);