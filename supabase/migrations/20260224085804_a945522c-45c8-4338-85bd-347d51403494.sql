CREATE POLICY "Admins can delete finishing daily logs"
ON public.finishing_daily_logs
FOR DELETE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));