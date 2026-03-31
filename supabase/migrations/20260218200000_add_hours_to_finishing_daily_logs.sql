-- Add planned_hours and actual_hours to finishing_daily_logs
-- planned_hours: stored on TARGET logs (total working hours planned for the day)
-- actual_hours: stored on OUTPUT logs (actual hours worked that day)
ALTER TABLE public.finishing_daily_logs ADD COLUMN planned_hours numeric DEFAULT NULL;
ALTER TABLE public.finishing_daily_logs ADD COLUMN actual_hours numeric DEFAULT NULL;
