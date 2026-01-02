-- Add UPDATE policies for production updates tables so blockers can be resolved
CREATE POLICY "Admins can update sewing updates"
ON public.production_updates_sewing
FOR UPDATE
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));

CREATE POLICY "Admins can update finishing updates"
ON public.production_updates_finishing
FOR UPDATE
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));