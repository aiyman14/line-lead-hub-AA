-- =============================================================================
-- Update Buyer RLS Policies — Add Factory Scoping (Defense-in-Depth)
-- =============================================================================
-- Current buyer policies only check buyer_po_access membership. For multi-
-- factory buyers, we add factory_id = get_user_factory_id(auth.uid()) so
-- buyers only see data from their active workspace, even if they have
-- buyer_po_access rows in multiple factories.
-- =============================================================================

-- ── work_orders ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers can view assigned work orders" ON public.work_orders;

CREATE POLICY "Buyers can view assigned work orders"
ON public.work_orders FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = work_orders.id AND bpa.user_id = auth.uid()
  )
);

-- ── sewing_targets ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers can view sewing targets for assigned POs" ON public.sewing_targets;

CREATE POLICY "Buyers can view sewing targets for assigned POs"
ON public.sewing_targets FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = sewing_targets.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── sewing_actuals ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers can view sewing actuals for assigned POs" ON public.sewing_actuals;

CREATE POLICY "Buyers can view sewing actuals for assigned POs"
ON public.sewing_actuals FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = sewing_actuals.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── cutting_targets ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers can view cutting targets for assigned POs" ON public.cutting_targets;

CREATE POLICY "Buyers can view cutting targets for assigned POs"
ON public.cutting_targets FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = cutting_targets.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── cutting_actuals ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers can view cutting actuals for assigned POs" ON public.cutting_actuals;

CREATE POLICY "Buyers can view cutting actuals for assigned POs"
ON public.cutting_actuals FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = cutting_actuals.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── finishing_targets ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers can view finishing targets for assigned POs" ON public.finishing_targets;

CREATE POLICY "Buyers can view finishing targets for assigned POs"
ON public.finishing_targets FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = finishing_targets.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── finishing_actuals ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers can view finishing actuals for assigned POs" ON public.finishing_actuals;

CREATE POLICY "Buyers can view finishing actuals for assigned POs"
ON public.finishing_actuals FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = finishing_actuals.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── finishing_daily_logs ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers can view finishing logs for assigned POs" ON public.finishing_daily_logs;

CREATE POLICY "Buyers can view finishing logs for assigned POs"
ON public.finishing_daily_logs FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND factory_id IN (SELECT factory_id FROM public.profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = finishing_daily_logs.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── work_order_line_assignments ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers can view line assignments for assigned POs" ON public.work_order_line_assignments;

CREATE POLICY "Buyers can view line assignments for assigned POs"
ON public.work_order_line_assignments FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = work_order_line_assignments.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- ── extras_ledger ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers can view extras ledger for assigned POs" ON public.extras_ledger;

CREATE POLICY "Buyers can view extras ledger for assigned POs"
ON public.extras_ledger FOR SELECT TO authenticated
USING (
  is_buyer_role(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = extras_ledger.work_order_id AND bpa.user_id = auth.uid()
  )
);
