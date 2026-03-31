-- Add 'sewing' and 'finishing' as standalone roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sewing';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finishing';
