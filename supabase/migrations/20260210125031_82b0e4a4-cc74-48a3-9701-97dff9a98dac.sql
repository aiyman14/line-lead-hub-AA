-- Create app_error_logs table for client-side error monitoring
CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  stack TEXT,
  source TEXT,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'info')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE SET NULL,
  url TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_error_logs_created_at ON public.app_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_error_logs_severity ON public.app_error_logs (severity);
CREATE INDEX IF NOT EXISTS idx_app_error_logs_factory_id ON public.app_error_logs (factory_id);

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert error logs"
  ON public.app_error_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read error logs"
  ON public.app_error_logs FOR SELECT
  USING (
    is_admin_or_higher(auth.uid())
    AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL)
  );

CREATE POLICY "Admins can update error logs"
  ON public.app_error_logs FOR UPDATE
  USING (
    is_admin_or_higher(auth.uid())
    AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL)
  );

CREATE POLICY "Admins can delete error logs"
  ON public.app_error_logs FOR DELETE
  USING (
    is_admin_or_higher(auth.uid())
    AND (factory_id = get_user_factory_id(auth.uid()) OR factory_id IS NULL)
  );