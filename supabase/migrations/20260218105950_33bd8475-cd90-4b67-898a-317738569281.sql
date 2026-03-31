ALTER TABLE public.storage_bin_cards
  ADD COLUMN bin_group_id UUID DEFAULT NULL;

CREATE INDEX idx_storage_bin_cards_group
  ON public.storage_bin_cards(bin_group_id)
  WHERE bin_group_id IS NOT NULL;