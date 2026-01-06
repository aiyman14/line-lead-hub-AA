-- First migration: Add new enum values
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'growth';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'scale';