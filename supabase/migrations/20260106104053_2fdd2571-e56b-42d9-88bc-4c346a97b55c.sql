-- Add new optional fields to work_orders for storage auto-fill
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS supplier_name text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS construction text,
ADD COLUMN IF NOT EXISTS width text,
ADD COLUMN IF NOT EXISTS package_qty integer;

-- Create storage_bin_cards table (header record per PO)
CREATE TABLE public.storage_bin_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  buyer text,
  style text,
  supplier_name text,
  description text,
  construction text,
  color text,
  width text,
  package_qty text,
  prepared_by text,
  prepared_by_user_id uuid,
  is_header_locked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(factory_id, work_order_id)
);

-- Create storage_bin_card_transactions table (daily rows)
CREATE TABLE public.storage_bin_card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_card_id uuid NOT NULL REFERENCES public.storage_bin_cards(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  receive_qty integer NOT NULL DEFAULT 0 CHECK (receive_qty >= 0),
  issue_qty integer NOT NULL DEFAULT 0 CHECK (issue_qty >= 0),
  ttl_receive integer NOT NULL DEFAULT 0,
  balance_qty integer NOT NULL DEFAULT 0,
  remarks text,
  submitted_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_storage_bin_cards_factory ON public.storage_bin_cards(factory_id);
CREATE INDEX idx_storage_bin_cards_work_order ON public.storage_bin_cards(work_order_id);
CREATE INDEX idx_storage_txn_bin_card ON public.storage_bin_card_transactions(bin_card_id);
CREATE INDEX idx_storage_txn_date ON public.storage_bin_card_transactions(transaction_date);

-- Enable RLS
ALTER TABLE public.storage_bin_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_bin_card_transactions ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has storage role
CREATE OR REPLACE FUNCTION public.has_storage_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'storage'
  )
$$;

-- RLS Policies for storage_bin_cards

-- Users in factory can view bin cards
CREATE POLICY "Users can view bin cards in their factory"
ON public.storage_bin_cards
FOR SELECT
USING (
  (factory_id = get_user_factory_id(auth.uid())) 
  OR is_superadmin(auth.uid())
);

-- Storage users can create bin cards
CREATE POLICY "Storage users can create bin cards"
ON public.storage_bin_cards
FOR INSERT
WITH CHECK (
  (factory_id = get_user_factory_id(auth.uid()))
  AND (has_storage_role(auth.uid()) OR is_admin_or_higher(auth.uid()))
);

-- Storage users can update unlocked headers, admins can update any
CREATE POLICY "Users can update bin cards"
ON public.storage_bin_cards
FOR UPDATE
USING (
  (factory_id = get_user_factory_id(auth.uid()))
  AND (
    is_admin_or_higher(auth.uid())
    OR (has_storage_role(auth.uid()) AND is_header_locked = false)
  )
);

-- Only admins can delete bin cards
CREATE POLICY "Admins can delete bin cards"
ON public.storage_bin_cards
FOR DELETE
USING (
  is_admin_or_higher(auth.uid()) 
  AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
);

-- RLS Policies for storage_bin_card_transactions

-- Users in factory can view transactions
CREATE POLICY "Users can view transactions in their factory"
ON public.storage_bin_card_transactions
FOR SELECT
USING (
  (factory_id = get_user_factory_id(auth.uid())) 
  OR is_superadmin(auth.uid())
);

-- Storage users can create transactions (append-only)
CREATE POLICY "Storage users can create transactions"
ON public.storage_bin_card_transactions
FOR INSERT
WITH CHECK (
  (factory_id = get_user_factory_id(auth.uid()))
  AND (submitted_by = auth.uid())
  AND (has_storage_role(auth.uid()) OR is_admin_or_higher(auth.uid()))
);

-- Only admins can update transactions
CREATE POLICY "Admins can update transactions"
ON public.storage_bin_card_transactions
FOR UPDATE
USING (
  is_admin_or_higher(auth.uid()) 
  AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
);

-- Only admins can delete transactions
CREATE POLICY "Admins can delete transactions"
ON public.storage_bin_card_transactions
FOR DELETE
USING (
  is_admin_or_higher(auth.uid()) 
  AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
);

-- Trigger to update updated_at on storage_bin_cards
CREATE TRIGGER update_storage_bin_cards_updated_at
BEFORE UPDATE ON public.storage_bin_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();