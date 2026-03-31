-- Add indexes on work_order_id for production update tables.
-- These columns are frequently used in JOINs and WHERE clauses
-- but were missing indexes, causing full table scans.

CREATE INDEX IF NOT EXISTS idx_production_updates_sewing_work_order_id
  ON public.production_updates_sewing (work_order_id);

CREATE INDEX IF NOT EXISTS idx_production_updates_finishing_work_order_id
  ON public.production_updates_finishing (work_order_id);
