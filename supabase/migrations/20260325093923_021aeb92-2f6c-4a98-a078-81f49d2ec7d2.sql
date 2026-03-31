ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC,
  ADD COLUMN IF NOT EXISTS style_number  TEXT,
  ADD COLUMN IF NOT EXISTS hs_code       TEXT;

NOTIFY pgrst, 'reload schema';