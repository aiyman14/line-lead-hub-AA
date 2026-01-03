-- Add DELETE policies for admins on production_updates_sewing
CREATE POLICY "Admins can delete sewing updates" 
ON public.production_updates_sewing 
FOR DELETE 
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));

-- Add DELETE policies for admins on production_updates_finishing
CREATE POLICY "Admins can delete finishing updates" 
ON public.production_updates_finishing 
FOR DELETE 
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));