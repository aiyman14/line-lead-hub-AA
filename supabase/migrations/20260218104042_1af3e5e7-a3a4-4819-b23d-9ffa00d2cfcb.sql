ALTER TABLE public.storage_bin_card_transactions
  ADD COLUMN batch_id UUID DEFAULT NULL;

CREATE INDEX idx_storage_txn_batch_id
  ON public.storage_bin_card_transactions(batch_id)
  WHERE batch_id IS NOT NULL;