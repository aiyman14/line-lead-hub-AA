
-- Drop the old "Workers can view assigned work orders" policy
-- This was too restrictive for cutting/finishing/storage users
DROP POLICY IF EXISTS "Workers can view assigned work orders" ON public.work_orders;

-- Add cutting users can view all factory work orders
CREATE POLICY "Cutting users can view factory work orders"
ON public.work_orders
FOR SELECT
TO authenticated
USING (
  factory_id = get_user_factory_id(auth.uid())
  AND has_cutting_role(auth.uid())
);

-- Re-create a sewing-only restricted policy (line-assignment based)
-- This only applies to users who are NOT admin, storage, or cutting
CREATE POLICY "Sewing workers can view assigned work orders"
ON public.work_orders
FOR SELECT
TO authenticated
USING (
  factory_id = get_user_factory_id(auth.uid())
  AND NOT is_admin_or_higher(auth.uid())
  AND NOT has_storage_role(auth.uid())
  AND NOT has_cutting_role(auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM work_order_line_assignments wola
      JOIN user_line_assignments ula ON ula.line_id = wola.line_id
      WHERE wola.work_order_id = work_orders.id AND ula.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM sewing_targets
      WHERE sewing_targets.work_order_id = work_orders.id AND sewing_targets.submitted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM sewing_actuals
      WHERE sewing_actuals.work_order_id = work_orders.id AND sewing_actuals.submitted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM finishing_targets
      WHERE finishing_targets.work_order_id = work_orders.id AND finishing_targets.submitted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM finishing_actuals
      WHERE finishing_actuals.work_order_id = work_orders.id AND finishing_actuals.submitted_by = auth.uid()
    )
  )
);
