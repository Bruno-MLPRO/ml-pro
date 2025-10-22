-- Fase 1: Adicionar coluna site_id à tabela mercado_livre_accounts
ALTER TABLE mercado_livre_accounts 
ADD COLUMN IF NOT EXISTS site_id TEXT DEFAULT 'MLB';

COMMENT ON COLUMN mercado_livre_accounts.site_id IS 'Site ID do Mercado Libre (MLB, MLM, MLA, etc.)';

-- Atualizar registros existentes para garantir que todos tenham site_id
UPDATE mercado_livre_accounts 
SET site_id = 'MLB' 
WHERE site_id IS NULL;