-- Add missing columns to production_updates_sewing to match AppSheet specification
-- These columns store auto-filled data from PO_MASTER and new worker-entered fields

-- Auto-filled from PO (stored per submission for historical accuracy)
ALTER TABLE public.production_updates_sewing 
ADD COLUMN IF NOT EXISTS buyer_name TEXT,
ADD COLUMN IF NOT EXISTS po_number TEXT,
ADD COLUMN IF NOT EXISTS style_code TEXT,
ADD COLUMN IF NOT EXISTS item_name TEXT,
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS order_qty INTEGER,
ADD COLUMN IF NOT EXISTS smv NUMERIC;

-- Auto-filled from Line (stored per submission)
ALTER TABLE public.production_updates_sewing 
ADD COLUMN IF NOT EXISTS unit_name TEXT,
ADD COLUMN IF NOT EXISTS floor_name TEXT,
ADD COLUMN IF NOT EXISTS factory_name TEXT;

-- Worker-entered tracking fields
ALTER TABLE public.production_updates_sewing 
ADD COLUMN IF NOT EXISTS cumulative_good_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_ex_factory DATE,
ADD COLUMN IF NOT EXISTS next_milestone TEXT;

-- Blocker fields to match AppSheet
ALTER TABLE public.production_updates_sewing 
ADD COLUMN IF NOT EXISTS blocker_resolution_date DATE,
ADD COLUMN IF NOT EXISTS action_taken_today TEXT;

-- Per Hour Target field
ALTER TABLE public.production_updates_sewing 
ADD COLUMN IF NOT EXISTS per_hour_target INTEGER DEFAULT 0;