
-- 1. Factory Finance Settings
CREATE TABLE IF NOT EXISTS factory_finance_settings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id        UUID        NOT NULL UNIQUE REFERENCES factory_accounts(id) ON DELETE CASCADE,
  invoice_prefix    TEXT        NOT NULL DEFAULT 'INV',
  seller_name       TEXT,
  seller_address    TEXT,
  seller_city       TEXT,
  seller_country    TEXT        DEFAULT 'Bangladesh',
  seller_phone      TEXT,
  seller_email      TEXT,
  tin_number        TEXT,
  bin_number        TEXT,
  bank_name         TEXT,
  bank_account_name TEXT,
  bank_account_no   TEXT,
  bank_routing_no   TEXT,
  bank_swift        TEXT,
  bank_branch       TEXT,
  stamp_url         TEXT,
  signature_url     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE factory_finance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory members can view finance settings"
  ON factory_finance_settings FOR SELECT
  USING (factory_id = get_user_factory_id(auth.uid()));

CREATE POLICY "Admins can manage finance settings"
  ON factory_finance_settings FOR ALL
  USING (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));

-- 2. New columns on invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type        TEXT NOT NULL DEFAULT 'commercial'
                                               CHECK (invoice_type IN ('commercial','proforma','credit_note','debit_note')),
  ADD COLUMN IF NOT EXISTS buyer_address       TEXT,
  ADD COLUMN IF NOT EXISTS buyer_contact       TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms       TEXT,
  ADD COLUMN IF NOT EXISTS lc_number          TEXT,
  ADD COLUMN IF NOT EXISTS lc_date             DATE,
  ADD COLUMN IF NOT EXISTS contract_number     TEXT,
  ADD COLUMN IF NOT EXISTS port_of_loading     TEXT,
  ADD COLUMN IF NOT EXISTS port_of_discharge   TEXT,
  ADD COLUMN IF NOT EXISTS country_of_origin   TEXT DEFAULT 'Bangladesh',
  ADD COLUMN IF NOT EXISTS country_of_dest     TEXT,
  ADD COLUMN IF NOT EXISTS vessel_name         TEXT,
  ADD COLUMN IF NOT EXISTS bl_number           TEXT,
  ADD COLUMN IF NOT EXISTS bl_date             DATE,
  ADD COLUMN IF NOT EXISTS incoterms           TEXT,
  ADD COLUMN IF NOT EXISTS packing_type        TEXT,
  ADD COLUMN IF NOT EXISTS total_cartons       INTEGER,
  ADD COLUMN IF NOT EXISTS total_gross_weight  NUMERIC,
  ADD COLUMN IF NOT EXISTS total_net_weight    NUMERIC,
  ADD COLUMN IF NOT EXISTS total_cbm           NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_pct        NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_details        JSONB,
  ADD COLUMN IF NOT EXISTS show_bank_details   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS remarks             TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes      TEXT;

-- 3. New columns on invoice_line_items
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS style_name   TEXT,
  ADD COLUMN IF NOT EXISTS hs_code      TEXT,
  ADD COLUMN IF NOT EXISTS unit         TEXT DEFAULT 'PCS',
  ADD COLUMN IF NOT EXISTS color        TEXT,
  ADD COLUMN IF NOT EXISTS size_range   TEXT,
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC DEFAULT 0;

-- 4. Invoice charges
CREATE TABLE IF NOT EXISTS invoice_charges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  amount      NUMERIC     NOT NULL DEFAULT 0,
  is_deduct   BOOLEAN     NOT NULL DEFAULT false,
  sort_order  INTEGER     NOT NULL DEFAULT 0
);

ALTER TABLE invoice_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory members can view charges"
  ON invoice_charges FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));

CREATE POLICY "Admins can manage charges"
  ON invoice_charges FOR ALL
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())))
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));

-- 5. Invoice tax lines
CREATE TABLE IF NOT EXISTS invoice_tax_lines (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  rate_pct    NUMERIC     NOT NULL DEFAULT 0,
  amount      NUMERIC     NOT NULL DEFAULT 0,
  sort_order  INTEGER     NOT NULL DEFAULT 0
);

ALTER TABLE invoice_tax_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory members can view tax lines"
  ON invoice_tax_lines FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));

CREATE POLICY "Admins can manage tax lines"
  ON invoice_tax_lines FOR ALL
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));

-- 6. Factory account finance columns
ALTER TABLE factory_accounts
  ADD COLUMN IF NOT EXISTS bdt_to_usd_rate NUMERIC DEFAULT 110,
  ADD COLUMN IF NOT EXISTS finance_enabled BOOLEAN DEFAULT true;

NOTIFY pgrst, 'reload schema';
