-- First migration: Add storage role to enum and create tables
-- Add 'storage' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'storage';