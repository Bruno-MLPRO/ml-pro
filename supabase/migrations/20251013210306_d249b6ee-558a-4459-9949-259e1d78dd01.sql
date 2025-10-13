-- Adicionar novos campos para métricas detalhadas de reputação
ALTER TABLE mercado_livre_metrics
  ADD COLUMN IF NOT EXISTS reputation_color TEXT,
  ADD COLUMN IF NOT EXISTS claims_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claims_value INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delayed_handling_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delayed_handling_value INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellations_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellations_value INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negative_ratings_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neutral_ratings_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS positive_ratings_rate NUMERIC DEFAULT 0;

-- Habilitar realtime apenas para as tabelas que ainda não têm
DO $$
BEGIN
  -- Adicionar tabelas se ainda não estiverem na publicação
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'mercado_livre_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mercado_livre_orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'mercado_livre_full_stock'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mercado_livre_full_stock;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'mercado_livre_metrics'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mercado_livre_metrics;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'mercado_livre_accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mercado_livre_accounts;
  END IF;
END $$;