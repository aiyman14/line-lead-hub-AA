-- Add RLS policy for admins to update profiles in their factory
CREATE POLICY "Admins can update profiles in their factory"
ON public.profiles
FOR UPDATE
USING (
  is_admin_or_higher(auth.uid()) 
  AND (
    factory_id = get_user_factory_id(auth.uid()) 
    OR is_superadmin(auth.uid())
  )
);