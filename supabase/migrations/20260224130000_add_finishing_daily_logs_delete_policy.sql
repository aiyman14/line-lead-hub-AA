-- Fix: finishing_daily_logs had no DELETE policy, so deletes silently did nothing (RLS blocked them)
-- Add admin delete policy matching the pattern used by all other submission tables
CREATE POLICY "Admins can delete finishing daily logs"
ON public.finishing_daily_logs
FOR DELETE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));
