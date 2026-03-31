-- Drop the existing policy that doesn't handle is_global properly
DROP POLICY IF EXISTS "Admins can manage factory docs" ON public.knowledge_documents;

-- Create updated policy that allows admins to manage factory docs AND global docs
CREATE POLICY "Admins can manage knowledge docs" ON public.knowledge_documents
  FOR ALL USING (
    is_admin_or_higher(auth.uid()) 
    AND (
      factory_id = get_user_factory_id(auth.uid()) 
      OR factory_id IS NULL  -- Allow global docs (is_global = true)
      OR is_superadmin(auth.uid())
    )
  )
  WITH CHECK (
    is_admin_or_higher(auth.uid()) 
    AND (
      factory_id = get_user_factory_id(auth.uid()) 
      OR factory_id IS NULL  -- Allow inserting global docs
      OR is_superadmin(auth.uid())
    )
  );