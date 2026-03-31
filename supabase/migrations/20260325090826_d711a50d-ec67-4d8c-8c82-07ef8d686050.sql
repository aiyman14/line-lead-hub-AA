
-- Drop existing conflicting policies on factory_finance_settings
DROP POLICY IF EXISTS "Admins can manage finance settings" ON factory_finance_settings;
DROP POLICY IF EXISTS "Factory members can view finance settings" ON factory_finance_settings;

-- Drop and recreate factory_finance_settings with new schema
DROP TABLE IF EXISTS factory_finance_settings CASCADE;

CREATE TABLE factory_finance_settings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id        UUID        NOT NULL UNIQUE REFERENCES factory_accounts(id) ON DELETE CASCADE,
  invoice_prefix    TEXT        NOT NULL DEFAULT 'INV',
  seller_address    TEXT,
  seller_contact    TEXT,
  trade_licence     TEXT,
  tin               TEXT,
  bin               TEXT,
  bank_name         TEXT,
  bank_branch       TEXT,
  bank_account      TEXT,
  bank_swift        TEXT,
  bank_routing      TEXT,
  stamp_url         TEXT,
  signature_url     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_factory_finance_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS factory_finance_settings_updated_at ON factory_finance_settings;
CREATE TRIGGER factory_finance_settings_updated_at
  BEFORE UPDATE ON factory_finance_settings
  FOR EACH ROW EXECUTE FUNCTION update_factory_finance_settings_updated_at();

ALTER TABLE factory_finance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage finance settings"
  ON factory_finance_settings FOR ALL
  USING (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()));

CREATE POLICY "Factory members can view finance settings"
  ON factory_finance_settings FOR SELECT
  USING (factory_id = get_user_factory_id(auth.uid()));

-- Add columns to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS buyer_address      TEXT,
  ADD COLUMN IF NOT EXISTS buyer_contact      TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms_text TEXT,
  ADD COLUMN IF NOT EXISTS po_numbers         TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contract_ref       TEXT,
  ADD COLUMN IF NOT EXISTS ship_to_address    TEXT,
  ADD COLUMN IF NOT EXISTS container_number   TEXT,
  ADD COLUMN IF NOT EXISTS discount_type      TEXT    CHECK (discount_type IN ('percentage','flat')),
  ADD COLUMN IF NOT EXISTS discount_value     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_memo      TEXT,
  ADD COLUMN IF NOT EXISTS paper_size         TEXT    NOT NULL DEFAULT 'A4',
  ADD COLUMN IF NOT EXISTS copy_marking       TEXT    NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS attachment_refs    JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS custom_fields      JSONB   DEFAULT '{}';

-- Add columns to invoice_line_items
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS discount_type  TEXT    CHECK (discount_type IN ('percentage','flat')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0;

-- Drop existing conflicting policies on invoice_charges
DROP POLICY IF EXISTS "Factory members can view charges" ON invoice_charges;
DROP POLICY IF EXISTS "Admins can manage charges" ON invoice_charges;
DROP POLICY IF EXISTS "Admins can manage invoice charges" ON invoice_charges;
DROP POLICY IF EXISTS "Factory members can view invoice charges" ON invoice_charges;

-- Recreate invoice_charges with updated schema
DROP TABLE IF EXISTS invoice_charges CASCADE;

CREATE TABLE invoice_charges (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description  TEXT        NOT NULL,
  amount       NUMERIC     NOT NULL DEFAULT 0,
  charge_type  TEXT        NOT NULL DEFAULT 'charge'
               CHECK (charge_type IN ('charge','deduction')),
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoice_charges_invoice_id_idx ON invoice_charges(invoice_id);
ALTER TABLE invoice_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invoice charges"
  ON invoice_charges FOR ALL
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())))
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));

CREATE POLICY "Factory members can view invoice charges"
  ON invoice_charges FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));

-- Drop existing conflicting policies on invoice_tax_lines
DROP POLICY IF EXISTS "Factory members can view tax lines" ON invoice_tax_lines;
DROP POLICY IF EXISTS "Admins can manage tax lines" ON invoice_tax_lines;
DROP POLICY IF EXISTS "Admins can manage invoice tax lines" ON invoice_tax_lines;
DROP POLICY IF EXISTS "Factory members can view invoice tax lines" ON invoice_tax_lines;

-- Recreate invoice_tax_lines with updated schema
DROP TABLE IF EXISTS invoice_tax_lines CASCADE;

CREATE TABLE invoice_tax_lines (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description  TEXT        NOT NULL DEFAULT 'VAT',
  rate         NUMERIC     DEFAULT 0,
  amount       NUMERIC     NOT NULL DEFAULT 0,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoice_tax_lines_invoice_id_idx ON invoice_tax_lines(invoice_id);
ALTER TABLE invoice_tax_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invoice tax lines"
  ON invoice_tax_lines FOR ALL
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())))
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));

CREATE POLICY "Factory members can view invoice tax lines"
  ON invoice_tax_lines FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE factory_id = get_user_factory_id(auth.uid())));

NOTIFY pgrst, 'reload schema';
