-- =============================================================================
-- Buyer RLS Policies
-- =============================================================================
-- Buyers have factory_id on their profile (needed for auth), but must NOT get
-- factory-wide access to production tables. We replace existing SELECT policies
-- with two policies: one for factory users (non-buyer) and one for buyers
-- scoped to their assigned POs via buyer_po_access.
-- =============================================================================

-- ── work_orders ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view work orders in their factory" ON public.work_orders;

CREATE POLICY "Factory users can view work orders"
ON public.work_orders FOR SELECT TO authenticated
USING (
  (NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()))
  OR is_superadmin(auth.uid())
);

CREATE POLICY "Buyers can view assigned work orders"
ON public.work_orders FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = work_orders.id AND bpa.user_id = auth.uid()
  )
);

-- ── sewing_targets ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view sewing targets in their factory" ON public.sewing_targets;

CREATE POLICY "Factory users can view sewing targets"
ON public.sewing_targets FOR SELECT TO authenticated
USING (
  (NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()))
  OR is_superadmin(auth.uid())
);

CREATE POLICY "Buyers can view sewing targets for assigned POs"
ON public.sewing_targets FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = sewing_targets.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── sewing_actuals ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view sewing actuals in their factory" ON public.sewing_actuals;

CREATE POLICY "Factory users can view sewing actuals"
ON public.sewing_actuals FOR SELECT TO authenticated
USING (
  (NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()))
  OR is_superadmin(auth.uid())
);

CREATE POLICY "Buyers can view sewing actuals for assigned POs"
ON public.sewing_actuals FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = sewing_actuals.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── cutting_targets ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view cutting targets in their factory" ON public.cutting_targets;

CREATE POLICY "Factory users can view cutting targets"
ON public.cutting_targets FOR SELECT TO authenticated
USING (
  (NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()))
  OR is_superadmin(auth.uid())
);

CREATE POLICY "Buyers can view cutting targets for assigned POs"
ON public.cutting_targets FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = cutting_targets.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── cutting_actuals ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view cutting actuals in their factory" ON public.cutting_actuals;

CREATE POLICY "Factory users can view cutting actuals"
ON public.cutting_actuals FOR SELECT TO authenticated
USING (
  (NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()))
  OR is_superadmin(auth.uid())
);

CREATE POLICY "Buyers can view cutting actuals for assigned POs"
ON public.cutting_actuals FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = cutting_actuals.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── finishing_targets ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view finishing targets in their factory" ON public.finishing_targets;

CREATE POLICY "Factory users can view finishing targets"
ON public.finishing_targets FOR SELECT TO authenticated
USING (
  (NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()))
  OR is_superadmin(auth.uid())
);

CREATE POLICY "Buyers can view finishing targets for assigned POs"
ON public.finishing_targets FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = finishing_targets.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── finishing_actuals ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view finishing actuals in their factory" ON public.finishing_actuals;

CREATE POLICY "Factory users can view finishing actuals"
ON public.finishing_actuals FOR SELECT TO authenticated
USING (
  (NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()))
  OR is_superadmin(auth.uid())
);

CREATE POLICY "Buyers can view finishing actuals for assigned POs"
ON public.finishing_actuals FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = finishing_actuals.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── finishing_daily_logs ────────────────────────────────────────────────────
-- Note: This table uses a subquery pattern for its existing policy
DROP POLICY IF EXISTS "Users can view finishing logs in their factory" ON public.finishing_daily_logs;

CREATE POLICY "Factory users can view finishing logs"
ON public.finishing_daily_logs FOR SELECT TO authenticated
USING (
  NOT is_buyer_role(auth.uid())
  AND factory_id IN (SELECT factory_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Buyers can view finishing logs for assigned POs"
ON public.finishing_daily_logs FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = finishing_daily_logs.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── work_order_line_assignments ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view work order line assignments in their factory" ON public.work_order_line_assignments;

CREATE POLICY "Factory users can view work order line assignments"
ON public.work_order_line_assignments FOR SELECT TO authenticated
USING (
  (NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()))
  OR is_superadmin(auth.uid())
);

CREATE POLICY "Buyers can view line assignments for assigned POs"
ON public.work_order_line_assignments FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = work_order_line_assignments.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── extras_ledger ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view extras ledger for their factory" ON public.extras_ledger;

CREATE POLICY "Factory users can view extras ledger"
ON public.extras_ledger FOR SELECT TO authenticated
USING (
  (NOT is_buyer_role(auth.uid()) AND factory_id = get_user_factory_id(auth.uid()))
  OR is_superadmin(auth.uid())
);

CREATE POLICY "Buyers can view extras ledger for assigned POs"
ON public.extras_ledger FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = extras_ledger.work_order_id AND bpa.user_id = auth.uid()
  )
);
