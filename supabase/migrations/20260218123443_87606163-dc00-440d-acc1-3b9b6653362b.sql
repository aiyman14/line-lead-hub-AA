ALTER TABLE public.storage_bin_cards
  ADD COLUMN po_set_signature TEXT DEFAULT NULL,
  ADD COLUMN group_name TEXT DEFAULT NULL;

CREATE INDEX idx_storage_bin_cards_po_set_sig
  ON public.storage_bin_cards(po_set_signature)
  WHERE po_set_signature IS NOT NULL;