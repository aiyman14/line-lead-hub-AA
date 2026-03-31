-- Fix contradictory NOT NULL + ON DELETE SET NULL on line_id columns.
-- A line with production data should not be deletable (RESTRICT),
-- rather than silently NULLing out the reference (which violates NOT NULL anyway).

-- production_updates_sewing: drop old FK, add RESTRICT
ALTER TABLE public.production_updates_sewing
  DROP CONSTRAINT IF EXISTS production_updates_sewing_line_id_fkey;

ALTER TABLE public.production_updates_sewing
  ADD CONSTRAINT production_updates_sewing_line_id_fkey
  FOREIGN KEY (line_id) REFERENCES public.lines(id) ON DELETE RESTRICT;

-- production_updates_finishing: drop old FK, add RESTRICT
ALTER TABLE public.production_updates_finishing
  DROP CONSTRAINT IF EXISTS production_updates_finishing_line_id_fkey;

ALTER TABLE public.production_updates_finishing
  ADD CONSTRAINT production_updates_finishing_line_id_fkey
  FOREIGN KEY (line_id) REFERENCES public.lines(id) ON DELETE RESTRICT;
