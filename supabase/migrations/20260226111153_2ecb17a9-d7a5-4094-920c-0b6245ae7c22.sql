ALTER TABLE finishing_daily_logs ADD COLUMN IF NOT EXISTS m_power_planned integer DEFAULT 0;
ALTER TABLE finishing_daily_logs ADD COLUMN IF NOT EXISTS m_power_actual integer DEFAULT 0;