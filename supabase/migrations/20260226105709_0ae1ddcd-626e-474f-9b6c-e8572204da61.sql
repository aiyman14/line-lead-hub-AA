ALTER TABLE finishing_targets ADD COLUMN IF NOT EXISTS ot_manpower_planned integer DEFAULT 0;
ALTER TABLE finishing_actuals ADD COLUMN IF NOT EXISTS ot_manpower_actual integer DEFAULT 0;