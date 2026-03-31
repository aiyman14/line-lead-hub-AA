
-- Allow storage role users to view all work orders in their factory
CREATE POLICY "Storage users can view factory work orders"
ON public.work_orders
FOR SELECT
TO authenticated
USING (
  factory_id = get_user_factory_id(auth.uid())
  AND has_storage_role(auth.uid())
);
