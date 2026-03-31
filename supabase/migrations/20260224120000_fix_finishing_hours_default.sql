-- Fix: planned_hours and actual_hours were incorrectly set to DEFAULT 1
-- A previous migration mass-updated all rows to 1 and set the column default to 1.
-- This caused new target forms to pre-fill with 1 and all subsequent submissions to also store 1.
-- Resetting default to NULL so new inserts that don't specify a value stay NULL (not 1).
ALTER TABLE public.finishing_daily_logs ALTER COLUMN planned_hours SET DEFAULT NULL;
ALTER TABLE public.finishing_daily_logs ALTER COLUMN actual_hours SET DEFAULT NULL;
