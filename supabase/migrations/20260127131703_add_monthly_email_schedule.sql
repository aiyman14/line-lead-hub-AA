-- Add monthly option to schedule_type enum if it doesn't exist
DO $$
BEGIN
  -- Check if the enum value exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'monthly'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'schedule_type')
  ) THEN
    -- Add monthly to the enum
    ALTER TYPE schedule_type ADD VALUE 'monthly';
  END IF;
END$$;

-- Add day_of_month column to email_schedules table
ALTER TABLE email_schedules
ADD COLUMN IF NOT EXISTS day_of_month integer;

-- Add comment for documentation
COMMENT ON COLUMN email_schedules.day_of_month IS 'Day of month (1-28) for monthly schedules. Used only when schedule_type is monthly.';

-- Add check constraint to ensure day_of_month is between 1 and 28 if provided
ALTER TABLE email_schedules
ADD CONSTRAINT IF NOT EXISTS check_day_of_month_range
CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 28));
