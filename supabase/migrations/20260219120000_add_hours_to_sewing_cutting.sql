ALTER TABLE public.sewing_targets ADD COLUMN hours_planned NUMERIC DEFAULT NULL;
ALTER TABLE public.sewing_actuals ADD COLUMN hours_actual NUMERIC DEFAULT NULL;
ALTER TABLE public.cutting_targets ADD COLUMN hours_planned NUMERIC DEFAULT NULL;
ALTER TABLE public.cutting_actuals ADD COLUMN hours_actual NUMERIC DEFAULT NULL;
