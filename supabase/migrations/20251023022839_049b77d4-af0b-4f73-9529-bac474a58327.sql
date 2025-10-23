-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Configurar cron job para calcular métricas mensais
-- Executa todo dia 1 do mês às 00:00 UTC
SELECT cron.schedule(
  'calculate-monthly-metrics',
  '0 0 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://yxlxholcipprdozohwhn.supabase.co/functions/v1/calculate-monthly-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);