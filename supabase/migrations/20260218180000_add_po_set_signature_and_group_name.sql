-- Add po_set_signature for deterministic group matching (sorted work_order_ids joined by comma)
-- and group_name for optional user-friendly label
ALTER TABLE public.storage_bin_cards
  ADD COLUMN po_set_signature TEXT DEFAULT NULL,
  ADD COLUMN group_name TEXT DEFAULT NULL;

-- Index for fast lookup by po_set_signature within a factory
CREATE INDEX idx_storage_bin_cards_po_set_sig
  ON public.storage_bin_cards(po_set_signature)
  WHERE po_set_signature IS NOT NULL;
