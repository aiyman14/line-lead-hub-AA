-- Allow admins to delete profiles in their factory (for remove access)
CREATE POLICY "Admins can delete profiles in their factory" 
ON public.profiles 
FOR DELETE 
USING (
  is_admin_or_higher(auth.uid()) 
  AND (
    factory_id = get_user_factory_id(auth.uid()) 
    OR factory_id IS NULL 
    OR is_superadmin(auth.uid())
  )
);