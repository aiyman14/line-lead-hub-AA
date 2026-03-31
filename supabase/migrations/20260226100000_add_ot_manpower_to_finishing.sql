-- Add OT manpower columns to finishing tables (matching sewing pattern)
ALTER TABLE finishing_targets ADD COLUMN IF NOT EXISTS ot_manpower_planned integer DEFAULT 0;
ALTER TABLE finishing_actuals ADD COLUMN IF NOT EXISTS ot_manpower_actual integer DEFAULT 0;

-- Add manpower columns to finishing_daily_logs (process-based forms)
ALTER TABLE finishing_daily_logs ADD COLUMN IF NOT EXISTS m_power_planned integer DEFAULT 0;
ALTER TABLE finishing_daily_logs ADD COLUMN IF NOT EXISTS m_power_actual integer DEFAULT 0;
