-- Fase 2: Adicionar coluna has_active_campaigns
ALTER TABLE mercado_livre_accounts 
ADD COLUMN IF NOT EXISTS has_active_campaigns boolean DEFAULT NULL;

COMMENT ON COLUMN mercado_livre_accounts.has_active_campaigns IS 'Indica se a conta tem campanhas ativas no Product Ads';