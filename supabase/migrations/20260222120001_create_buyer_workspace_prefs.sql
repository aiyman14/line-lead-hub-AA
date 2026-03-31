-- =============================================================================
-- Buyer Workspace Preferences
-- =============================================================================
-- Per-workspace preferences for buyers. Global prefs (timezone, language) live
-- on the profiles table; this table stores workspace-specific settings.
-- =============================================================================

CREATE TABLE public.buyer_workspace_prefs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  daily_digest_enabled boolean DEFAULT false,
  alert_thresholds jsonb DEFAULT '{}',
  default_po_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, factory_id)
);

-- RLS
ALTER TABLE public.buyer_workspace_prefs ENABLE ROW LEVEL SECURITY;

-- Buyers manage own prefs
CREATE POLICY "Buyers manage own workspace prefs"
ON public.buyer_workspace_prefs FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
