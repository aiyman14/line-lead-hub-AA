ALTER TABLE public.finishing_daily_logs ADD COLUMN IF NOT EXISTS planned_hours numeric NULL;
ALTER TABLE public.finishing_daily_logs ADD COLUMN IF NOT EXISTS actual_hours numeric NULL;