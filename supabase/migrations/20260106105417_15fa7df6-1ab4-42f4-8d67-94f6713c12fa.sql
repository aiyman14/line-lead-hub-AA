-- Drop existing update policy and create a new one that allows storage users to update unlocked headers
DROP POLICY IF EXISTS "Users can update bin cards" ON public.storage_bin_cards;

CREATE POLICY "Users can update bin cards" 
ON public.storage_bin_cards 
FOR UPDATE 
USING (
  (factory_id = get_user_factory_id(auth.uid())) 
  AND (
    is_admin_or_higher(auth.uid()) 
    OR (has_storage_role(auth.uid()) AND (is_header_locked = false))
  )
)
WITH CHECK (
  (factory_id = get_user_factory_id(auth.uid())) 
  AND (
    is_admin_or_higher(auth.uid()) 
    OR (has_storage_role(auth.uid()) AND (is_header_locked = false))
  )
);