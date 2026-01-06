-- Add low_stock_threshold column to factory_accounts
ALTER TABLE public.factory_accounts 
ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 10;