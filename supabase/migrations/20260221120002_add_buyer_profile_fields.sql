-- Add buyer-specific fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS buyer_company_name text;
