-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can update profiles in their factory" ON public.profiles;

-- Create updated policy that allows admins to update profiles with NULL factory_id (new invites)
CREATE POLICY "Admins can update profiles in their factory" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (
  is_admin_or_higher(auth.uid()) AND (
    factory_id = get_user_factory_id(auth.uid()) 
    OR factory_id IS NULL  -- Allow updating new users with no factory yet
    OR is_superadmin(auth.uid())
  )
)
WITH CHECK (
  is_admin_or_higher(auth.uid()) AND (
    factory_id IS NULL 
    OR factory_id = get_user_factory_id(auth.uid()) 
    OR is_superadmin(auth.uid())
  )
);