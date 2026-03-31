
ALTER TABLE public.cutting_actuals
  ADD COLUMN IF NOT EXISTS ot_hours_actual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_manpower_actual integer DEFAULT 0;

ALTER TABLE public.cutting_targets
  ADD COLUMN IF NOT EXISTS ot_hours_planned numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_manpower_planned integer DEFAULT 0;

ALTER TABLE public.finishing_daily_logs
  ADD COLUMN IF NOT EXISTS ot_hours_actual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_manpower_actual integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_hours_planned numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_manpower_planned integer DEFAULT 0;
