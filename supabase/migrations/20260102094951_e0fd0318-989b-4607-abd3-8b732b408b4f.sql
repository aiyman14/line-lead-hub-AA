-- Drop and recreate the policy with better NULL handling
DROP POLICY IF EXISTS "Admins can create factory if no factory assigned" ON public.factory_accounts;

CREATE POLICY "Admins can create factory if no factory assigned"
ON public.factory_accounts
FOR INSERT
WITH CHECK (
  is_admin_or_higher(auth.uid()) AND 
  NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND factory_id IS NOT NULL)
);