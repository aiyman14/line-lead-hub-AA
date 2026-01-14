-- Create extras ledger table (enum may already exist from failed migration, so we use IF NOT EXISTS pattern)
DO $$ BEGIN
  CREATE TYPE public.extras_transaction_type AS ENUM (
    'sold',
    'transferred_to_stock',
    'replacement_shipment',
    'scrapped',
    'donated',
    'adjustment'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create extras ledger table
CREATE TABLE public.extras_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  factory_id UUID NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  transaction_type public.extras_transaction_type NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  notes TEXT,
  attachment_url TEXT,
  reference_number TEXT,
  is_admin_adjustment BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.extras_ledger ENABLE ROW LEVEL SECURITY;

-- Policies for extras_ledger using existing helper functions
CREATE POLICY "Users can view extras ledger for their factory"
ON public.extras_ledger
FOR SELECT
USING (
  factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())
);

CREATE POLICY "Users can insert extras ledger for their factory"
ON public.extras_ledger
FOR INSERT
WITH CHECK (
  factory_id = get_user_factory_id(auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Admins can update extras ledger for their factory"
ON public.extras_ledger
FOR UPDATE
USING (
  is_admin_or_higher(auth.uid()) 
  AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
);

CREATE POLICY "Admins can delete extras ledger for their factory"
ON public.extras_ledger
FOR DELETE
USING (
  is_admin_or_higher(auth.uid()) 
  AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
);

-- Create indexes for faster lookups
CREATE INDEX idx_extras_ledger_work_order_id ON public.extras_ledger(work_order_id);
CREATE INDEX idx_extras_ledger_factory_id ON public.extras_ledger(factory_id);