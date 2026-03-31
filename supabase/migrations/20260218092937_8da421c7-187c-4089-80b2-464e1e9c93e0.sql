ALTER TABLE public.finishing_daily_logs ALTER COLUMN line_id DROP NOT NULL;

ALTER TABLE public.finishing_daily_logs DROP CONSTRAINT IF EXISTS finishing_daily_logs_unique_entry;

DROP INDEX IF EXISTS finishing_daily_logs_unique_entry;

CREATE UNIQUE INDEX finishing_daily_logs_unique_entry
  ON public.finishing_daily_logs (
    factory_id,
    production_date,
    COALESCE(line_id, '00000000-0000-0000-0000-000000000000'::uuid),
    work_order_id,
    log_type
  );