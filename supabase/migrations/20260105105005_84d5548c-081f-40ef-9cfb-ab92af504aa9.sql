-- Add is_late column to sewing_targets
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS is_late boolean DEFAULT false;

-- Add is_late column to finishing_targets
ALTER TABLE public.finishing_targets ADD COLUMN IF NOT EXISTS is_late boolean DEFAULT false;