-- =============================================================================
-- Backfill Buyer Factory Memberships
-- =============================================================================
-- Migrate existing buyers: for every unique (user_id, factory_id) pair in
-- buyer_po_access, create a membership row. Also pull company_name from
-- profiles.buyer_company_name and granted_by from buyer_po_access.
-- =============================================================================

INSERT INTO public.buyer_factory_memberships (user_id, factory_id, is_active, company_name, invited_by, created_at)
SELECT DISTINCT ON (bpa.user_id, bpa.factory_id)
  bpa.user_id,
  bpa.factory_id,
  true,
  p.buyer_company_name,
  bpa.granted_by,
  bpa.granted_at
FROM public.buyer_po_access bpa
JOIN public.profiles p ON p.id = bpa.user_id
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = bpa.user_id AND ur.role = 'buyer'
)
ON CONFLICT (user_id, factory_id) DO NOTHING;
