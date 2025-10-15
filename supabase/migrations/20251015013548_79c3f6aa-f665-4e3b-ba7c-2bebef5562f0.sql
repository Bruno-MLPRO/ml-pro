-- Create table for automatic sync logs
CREATE TABLE IF NOT EXISTS public.ml_auto_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  total_accounts INTEGER,
  successful_syncs INTEGER DEFAULT 0,
  failed_syncs INTEGER DEFAULT 0,
  tokens_renewed INTEGER DEFAULT 0,
  error_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_auto_sync_logs_started ON public.ml_auto_sync_logs(started_at DESC);

-- Enable RLS
ALTER TABLE public.ml_auto_sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow managers to view sync logs
CREATE POLICY "Managers can view sync logs"
  ON public.ml_auto_sync_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'manager'
    )
  );

-- Allow service role to insert/update (for the edge function)
CREATE POLICY "Service role can manage sync logs"
  ON public.ml_auto_sync_logs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing schedule if it exists
SELECT cron.unschedule('ml-auto-sync-all') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'ml-auto-sync-all'
);

-- Schedule the function to run daily at 3 AM
SELECT cron.schedule(
  'ml-auto-sync-all',
  '0 3 * * *',  -- Every day at 3:00 AM
  $$
  SELECT
    net.http_post(
      url := 'https://yxlxholcipprdozohwhn.supabase.co/functions/v1/ml-auto-sync-all',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('trigger', 'cron', 'time', NOW())
    ) as request_id;
  $$
);
