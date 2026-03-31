-- Add onboarding state columns to profiles for persistent one-time tracking
-- Scoped per user+factory (each profile row = one user in one factory)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_setup_dismissed_at timestamptz DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_tour_completed_at timestamptz DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_banner_dismissed_at timestamptz DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_version text DEFAULT 'v1';
