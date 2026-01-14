-- Add target daily actuals columns to cutting_targets table
ALTER TABLE public.cutting_targets 
ADD COLUMN IF NOT EXISTS day_cutting integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS day_input integer NOT NULL DEFAULT 0;

-- Add actual capacities columns to cutting_actuals table
ALTER TABLE public.cutting_actuals 
ADD COLUMN IF NOT EXISTS man_power integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS marker_capacity integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS lay_capacity integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cutting_capacity integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS under_qty integer DEFAULT 0;