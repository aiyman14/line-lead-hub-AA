-- =============================================================================
-- Buyer Factory Memberships
-- =============================================================================
-- Tracks all factory relationships for a buyer. A buyer can belong to multiple
-- factories (workspaces). profiles.factory_id acts as the "active workspace"
-- pointer; this table records the full set of memberships.
-- =============================================================================

CREATE TABLE public.buyer_factory_memberships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  company_name text,
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, factory_id)
);

-- Indexes
CREATE INDEX idx_bfm_user ON public.buyer_factory_memberships(user_id);
CREATE INDEX idx_bfm_factory ON public.buyer_factory_memberships(factory_id);
CREATE INDEX idx_bfm_user_active ON public.buyer_factory_memberships(user_id) WHERE is_active = true;

-- RLS
ALTER TABLE public.buyer_factory_memberships ENABLE ROW LEVEL SECURITY;

-- Buyers see own memberships (needed for workspace selector)
CREATE POLICY "Buyers view own memberships"
ON public.buyer_factory_memberships FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Admins manage memberships for their factory
CREATE POLICY "Admins manage buyer memberships"
ON public.buyer_factory_memberships FOR ALL TO authenticated
USING (
  is_admin_or_higher(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
);
