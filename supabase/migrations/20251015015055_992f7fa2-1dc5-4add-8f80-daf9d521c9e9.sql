-- Adicionar colunas para tracking de origem e confiança dos dados de health
ALTER TABLE public.mercado_livre_item_health 
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'api_performance',
ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.mercado_livre_item_health.data_source IS 'Origem dos dados: api_performance, api_health, estimated, reputation';
COMMENT ON COLUMN public.mercado_livre_item_health.confidence IS 'Nível de confiança dos dados (0-1): 1.0 para API oficial, 0.6 para estimado';
COMMENT ON COLUMN public.mercado_livre_item_health.last_error IS 'Última mensagem de erro ao buscar dados da API';