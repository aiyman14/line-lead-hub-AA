-- is_buyer_role helper
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

-- Create buyer_po_access table
CREATE TABLE IF NOT EXISTS public.buyer_po_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, work_order_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_po_access_user ON public.buyer_po_access(user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_po_access_wo ON public.buyer_po_access(work_order_id);

ALTER TABLE public.buyer_po_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers view own PO access" ON public.buyer_po_access;
CREATE POLICY "Buyers view own PO access"
ON public.buyer_po_access FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage buyer PO access" ON public.buyer_po_access;
CREATE POLICY "Admins manage buyer PO access"
ON public.buyer_po_access FOR ALL TO authenticated
USING (
  is_admin_or_higher(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
);

-- Add buyer_company_name to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS buyer_company_name text;

-- work_orders RLS
DROP POLICY IF EXISTS "Users can view work orders in their factory" ON public.work_orders;
DROP POLICY IF EXISTS "Factory users can view work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Buyers can view assigned work orders" ON public.work_orders;

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
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = work_orders.id AND bpa.user_id = auth.uid()
  )
);

-- sewing_targets RLS
DROP POLICY IF EXISTS "Users can view sewing targets in their factory" ON public.sewing_targets;
DROP POLICY IF EXISTS "Factory users can view sewing targets" ON public.sewing_targets;
DROP POLICY IF EXISTS "Buyers can view sewing targets for assigned POs" ON public.sewing_targets;

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
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = sewing_targets.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- sewing_actuals RLS
DROP POLICY IF EXISTS "Users can view sewing actuals in their factory" ON public.sewing_actuals;
DROP POLICY IF EXISTS "Factory users can view sewing actuals" ON public.sewing_actuals;
DROP POLICY IF EXISTS "Buyers can view sewing actuals for assigned POs" ON public.sewing_actuals;

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
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = sewing_actuals.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- cutting_targets RLS
DROP POLICY IF EXISTS "Users can view cutting targets in their factory" ON public.cutting_targets;
DROP POLICY IF EXISTS "Factory users can view cutting targets" ON public.cutting_targets;
DROP POLICY IF EXISTS "Buyers can view cutting targets for assigned POs" ON public.cutting_targets;

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
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = cutting_targets.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- cutting_actuals RLS
DROP POLICY IF EXISTS "Users can view cutting actuals in their factory" ON public.cutting_actuals;
DROP POLICY IF EXISTS "Factory users can view cutting actuals" ON public.cutting_actuals;
DROP POLICY IF EXISTS "Buyers can view cutting actuals for assigned POs" ON public.cutting_actuals;

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
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = cutting_actuals.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- finishing_targets RLS
DROP POLICY IF EXISTS "Users can view finishing targets in their factory" ON public.finishing_targets;
DROP POLICY IF EXISTS "Factory users can view finishing targets" ON public.finishing_targets;
DROP POLICY IF EXISTS "Buyers can view finishing targets for assigned POs" ON public.finishing_targets;

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
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = finishing_targets.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- finishing_actuals RLS
DROP POLICY IF EXISTS "Users can view finishing actuals in their factory" ON public.finishing_actuals;
DROP POLICY IF EXISTS "Factory users can view finishing actuals" ON public.finishing_actuals;
DROP POLICY IF EXISTS "Buyers can view finishing actuals for assigned POs" ON public.finishing_actuals;

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
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = finishing_actuals.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- finishing_daily_logs RLS
DROP POLICY IF EXISTS "Users can view finishing logs in their factory" ON public.finishing_daily_logs;
DROP POLICY IF EXISTS "Factory users can view finishing logs" ON public.finishing_daily_logs;
DROP POLICY IF EXISTS "Buyers can view finishing logs for assigned POs" ON public.finishing_daily_logs;

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
  AND factory_id IN (SELECT factory_id FROM public.profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = finishing_daily_logs.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- work_order_line_assignments RLS
DROP POLICY IF EXISTS "Users can view work order line assignments in their factory" ON public.work_order_line_assignments;
DROP POLICY IF EXISTS "Factory users can view work order line assignments" ON public.work_order_line_assignments;
DROP POLICY IF EXISTS "Buyers can view line assignments for assigned POs" ON public.work_order_line_assignments;

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
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = work_order_line_assignments.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- extras_ledger RLS
DROP POLICY IF EXISTS "Users can view extras ledger for their factory" ON public.extras_ledger;
DROP POLICY IF EXISTS "Factory users can view extras ledger" ON public.extras_ledger;
DROP POLICY IF EXISTS "Buyers can view extras ledger for assigned POs" ON public.extras_ledger;

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
  AND factory_id = get_user_factory_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.buyer_po_access bpa
    WHERE bpa.work_order_id = extras_ledger.work_order_id AND bpa.user_id = auth.uid()
  )
);

-- Create buyer_factory_memberships table
CREATE TABLE IF NOT EXISTS public.buyer_factory_memberships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  company_name text,
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, factory_id)
);

CREATE INDEX IF NOT EXISTS idx_bfm_user ON public.buyer_factory_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_bfm_factory ON public.buyer_factory_memberships(factory_id);
CREATE INDEX IF NOT EXISTS idx_bfm_user_active ON public.buyer_factory_memberships(user_id) WHERE is_active = true;

ALTER TABLE public.buyer_factory_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers view own memberships" ON public.buyer_factory_memberships;
CREATE POLICY "Buyers view own memberships"
ON public.buyer_factory_memberships FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage buyer memberships" ON public.buyer_factory_memberships;
CREATE POLICY "Admins manage buyer memberships"
ON public.buyer_factory_memberships FOR ALL TO authenticated
USING (
  is_admin_or_higher(auth.uid())
  AND factory_id = get_user_factory_id(auth.uid())
);

-- Create buyer_workspace_prefs table
CREATE TABLE IF NOT EXISTS public.buyer_workspace_prefs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  daily_digest_enabled boolean DEFAULT false,
  alert_thresholds jsonb DEFAULT '{}',
  default_po_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, factory_id)
);

ALTER TABLE public.buyer_workspace_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers manage own workspace prefs" ON public.buyer_workspace_prefs;
CREATE POLICY "Buyers manage own workspace prefs"
ON public.buyer_workspace_prefs FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Backfill existing buyers into memberships
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

-- Membership count helper function
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