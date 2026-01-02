-- Add new fields to production_updates_finishing to match AppSheet spec
ALTER TABLE public.production_updates_finishing
ADD COLUMN IF NOT EXISTS m_power integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS per_hour_target integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS day_qc_pass integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_qc_pass integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS day_poly integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_poly integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_production integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS day_over_time numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_over_time numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS day_hour numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_hour numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS day_carton integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_carton integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS remarks text,
ADD COLUMN IF NOT EXISTS style_no text,
ADD COLUMN IF NOT EXISTS buyer_name text,
ADD COLUMN IF NOT EXISTS item_name text,
ADD COLUMN IF NOT EXISTS order_quantity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_name text,
ADD COLUMN IF NOT EXISTS floor_name text,
ADD COLUMN IF NOT EXISTS factory_name text;

-- Add color to work_orders if not exists (for form display)
ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS color text;