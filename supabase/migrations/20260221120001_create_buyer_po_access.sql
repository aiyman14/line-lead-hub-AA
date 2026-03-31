-- buyer_po_access: join table controlling which POs a buyer user can see
CREATE TABLE public.buyer_po_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, work_order_id)
);

CREATE INDEX idx_buyer_po_access_user ON public.buyer_po_access(user_id);
CREATE INDEX idx_buyer_po_access_wo ON public.buyer_po_access(work_order_id);

ALTER TABLE public.buyer_po_access ENABLE ROW LEVEL SECURITY;

-- Buyers can see their own PO access records
CREATE POLICY "Buyers view own PO access"
ON public.buyer_po_access FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage all buyer PO access for their factory
CREATE POLICY "Admins manage buyer PO access"
ON public.buyer_po_access FOR ALL
TO authenticated
USING (
  is_admin_or_higher(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
);
