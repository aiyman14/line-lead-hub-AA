ALTER TABLE public.finishing_daily_logs ALTER COLUMN planned_hours SET DEFAULT 0;
ALTER TABLE public.finishing_daily_logs ALTER COLUMN actual_hours SET DEFAULT 0;
UPDATE public.finishing_daily_logs SET planned_hours = 0 WHERE planned_hours IS NULL;
UPDATE public.finishing_daily_logs SET actual_hours = 0 WHERE actual_hours IS NULL;