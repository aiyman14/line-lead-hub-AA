-- Prevent negative values on production quantity columns.
-- These CHECK constraints enforce data integrity at the DB level.

-- production_updates_sewing
ALTER TABLE public.production_updates_sewing
  ADD CONSTRAINT chk_sewing_output_qty CHECK (output_qty >= 0),
  ADD CONSTRAINT chk_sewing_target_qty CHECK (target_qty >= 0),
  ADD CONSTRAINT chk_sewing_manpower CHECK (manpower >= 0),
  ADD CONSTRAINT chk_sewing_ot_hours CHECK (ot_hours >= 0),
  ADD CONSTRAINT chk_sewing_ot_manpower CHECK (ot_manpower >= 0),
  ADD CONSTRAINT chk_sewing_reject_qty CHECK (reject_qty >= 0),
  ADD CONSTRAINT chk_sewing_rework_qty CHECK (rework_qty >= 0);

-- production_updates_finishing
ALTER TABLE public.production_updates_finishing
  ADD CONSTRAINT chk_finishing_qc_pass_qty CHECK (qc_pass_qty >= 0),
  ADD CONSTRAINT chk_finishing_qc_fail_qty CHECK (qc_fail_qty >= 0),
  ADD CONSTRAINT chk_finishing_packed_qty CHECK (packed_qty >= 0),
  ADD CONSTRAINT chk_finishing_shipped_qty CHECK (shipped_qty >= 0),
  ADD CONSTRAINT chk_finishing_manpower CHECK (manpower >= 0),
  ADD CONSTRAINT chk_finishing_ot_hours CHECK (ot_hours >= 0),
  ADD CONSTRAINT chk_finishing_ot_manpower CHECK (ot_manpower >= 0);

-- cutting_targets
ALTER TABLE public.cutting_targets
  ADD CONSTRAINT chk_cutting_targets_order_qty CHECK (order_qty >= 0),
  ADD CONSTRAINT chk_cutting_targets_man_power CHECK (man_power >= 0),
  ADD CONSTRAINT chk_cutting_targets_marker_capacity CHECK (marker_capacity >= 0),
  ADD CONSTRAINT chk_cutting_targets_lay_capacity CHECK (lay_capacity >= 0),
  ADD CONSTRAINT chk_cutting_targets_cutting_capacity CHECK (cutting_capacity >= 0);

-- cutting_actuals (leftover_quantity already has a CHECK)
ALTER TABLE public.cutting_actuals
  ADD CONSTRAINT chk_cutting_actuals_day_cutting CHECK (day_cutting >= 0),
  ADD CONSTRAINT chk_cutting_actuals_day_input CHECK (day_input >= 0);
