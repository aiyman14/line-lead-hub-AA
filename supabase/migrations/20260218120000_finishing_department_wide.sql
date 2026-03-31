-- Make finishing_daily_logs.line_id nullable so finishing department workers
-- can submit logs without being bound to a specific line.
ALTER TABLE public.finishing_daily_logs ALTER COLUMN line_id DROP NOT NULL;

-- Drop old unique constraint that requires line_id
ALTER TABLE public.finishing_daily_logs DROP CONSTRAINT IF EXISTS finishing_daily_logs_unique_entry;

-- Recreate unique index using COALESCE to handle null line_id
-- This ensures one TARGET and one OUTPUT per {date + line_id(or null) + work_order_id}
CREATE UNIQUE INDEX finishing_daily_logs_unique_entry
  ON public.finishing_daily_logs (
    factory_id,
    production_date,
    COALESCE(line_id, '00000000-0000-0000-0000-000000000000'::uuid),
    work_order_id,
    log_type
  );
