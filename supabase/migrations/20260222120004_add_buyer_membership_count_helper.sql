-- =============================================================================
-- Buyer Membership Count Helper
-- =============================================================================
-- Returns the number of active factory memberships for a buyer user.
-- Used by the workspace selector and login routing logic.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_buyer_membership_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.buyer_factory_memberships
  WHERE user_id = _user_id AND is_active = true
$$;
