-- Prevent duplicate daily entries per bin card.
-- Each bin card should have at most one transaction per date.
ALTER TABLE public.storage_bin_card_transactions
  ADD CONSTRAINT uq_bin_card_transaction_date UNIQUE (bin_card_id, transaction_date);
