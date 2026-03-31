
-- Update existing 0 or NULL values to 1
UPDATE public.finishing_daily_logs SET planned_hours = 1 WHERE planned_hours IS NULL OR planned_hours = 0;
UPDATE public.finishing_daily_logs SET actual_hours = 1 WHERE actual_hours IS NULL OR actual_hours = 0;

-- Set default to 1
ALTER TABLE public.finishing_daily_logs ALTER COLUMN planned_hours SET DEFAULT 1;
ALTER TABLE public.finishing_daily_logs ALTER COLUMN actual_hours SET DEFAULT 1;

-- Add check constraints to ensure values > 0
ALTER TABLE public.finishing_daily_logs ADD CONSTRAINT finishing_daily_logs_planned_hours_positive CHECK (planned_hours > 0);
ALTER TABLE public.finishing_daily_logs ADD CONSTRAINT finishing_daily_logs_actual_hours_positive CHECK (actual_hours > 0);
