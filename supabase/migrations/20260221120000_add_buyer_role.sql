-- Add 'buyer' as a new role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'buyer';

-- Helper function to check if a user has the buyer role
CREATE OR REPLACE FUNCTION public.is_buyer_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'buyer'
  )
$$;
