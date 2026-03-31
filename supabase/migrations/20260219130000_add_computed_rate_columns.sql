-- Add computed rate columns for normalized target vs actual comparisons
-- Sewing: target is per-hour, so compute total planned; actual is total, so compute per-hour rate
ALTER TABLE public.sewing_targets ADD COLUMN target_total_planned NUMERIC DEFAULT NULL;
ALTER TABLE public.sewing_actuals ADD COLUMN actual_per_hour NUMERIC DEFAULT NULL;

-- Cutting: both target and actual are totals, so derive per-hour rates for both
ALTER TABLE public.cutting_targets ADD COLUMN target_per_hour NUMERIC DEFAULT NULL;
ALTER TABLE public.cutting_actuals ADD COLUMN actual_per_hour NUMERIC DEFAULT NULL;
