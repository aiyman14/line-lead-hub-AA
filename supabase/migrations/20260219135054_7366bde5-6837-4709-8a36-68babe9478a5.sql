
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS hours_planned NUMERIC DEFAULT NULL;
ALTER TABLE public.sewing_actuals ADD COLUMN IF NOT EXISTS hours_actual NUMERIC DEFAULT NULL;
ALTER TABLE public.cutting_targets ADD COLUMN IF NOT EXISTS hours_planned NUMERIC DEFAULT NULL;
ALTER TABLE public.cutting_actuals ADD COLUMN IF NOT EXISTS hours_actual NUMERIC DEFAULT NULL;

ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS target_total_planned NUMERIC DEFAULT NULL;
ALTER TABLE public.sewing_actuals ADD COLUMN IF NOT EXISTS actual_per_hour NUMERIC DEFAULT NULL;
ALTER TABLE public.cutting_targets ADD COLUMN IF NOT EXISTS target_per_hour NUMERIC DEFAULT NULL;
ALTER TABLE public.cutting_actuals ADD COLUMN IF NOT EXISTS actual_per_hour NUMERIC DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
