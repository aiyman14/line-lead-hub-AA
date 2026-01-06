-- Make cutting_section_id nullable in cutting_targets and cutting_actuals
ALTER TABLE cutting_targets ALTER COLUMN cutting_section_id DROP NOT NULL;
ALTER TABLE cutting_actuals ALTER COLUMN cutting_section_id DROP NOT NULL;