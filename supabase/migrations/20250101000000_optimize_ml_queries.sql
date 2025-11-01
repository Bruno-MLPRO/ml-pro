-- Migration: Otimização de queries do Mercado Livre
-- Adiciona índices para melhorar performance ao trocar de conta

-- Índice composto para produtos (usado frequentemente)
CREATE INDEX IF NOT EXISTS idx_ml_products_account_id_title 
ON mercado_livre_products(ml_account_id, title);

-- Índice para métricas por conta (usado em todo carregamento)
CREATE INDEX IF NOT EXISTS idx_ml_metrics_account_updated 
ON mercado_livre_metrics(ml_account_id, last_updated DESC);

-- Índice para health por conta
CREATE INDEX IF NOT EXISTS idx_ml_health_account 
ON mercado_livre_item_health(ml_account_id);

-- Índice para histórico de health
CREATE INDEX IF NOT EXISTS idx_ml_health_history_created 
ON mercado_livre_health_history(created_at DESC);

-- Índice para estoque FULL
CREATE INDEX IF NOT EXISTS idx_ml_full_stock_account 
ON mercado_livre_full_stock(ml_account_id);

-- Índice para campanhas
CREATE INDEX IF NOT EXISTS idx_ml_campaigns_account 
ON mercado_livre_campaigns(ml_account_id);

-- Índice composto para pedidos (data + conta)
CREATE INDEX IF NOT EXISTS idx_ml_orders_account_date 
ON mercado_livre_orders(ml_account_id, date_created DESC);

-- Índice para Product Ads
CREATE INDEX IF NOT EXISTS idx_ml_product_ads_account 
ON mercado_livre_product_ads(ml_account_id);

-- Comentários para documentação
COMMENT ON INDEX idx_ml_products_account_id_title IS 
'Otimiza busca de produtos por conta com ordenação por título';

COMMENT ON INDEX idx_ml_metrics_account_updated IS 
'Otimiza busca de métricas mais recentes por conta';

COMMENT ON INDEX idx_ml_health_account IS 
'Otimiza busca de health score por conta';

COMMENT ON INDEX idx_ml_orders_account_date IS 
'Otimiza busca de pedidos por conta e período';

