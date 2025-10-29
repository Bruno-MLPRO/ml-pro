-- Adicionar campos para armazenar múltiplos tipos de envio por produto
-- Um produto pode ter ME2 + Custom simultaneamente, ou múltiplos logistic_types dentro do ME2

-- 1. Adicionar campo JSONB para armazenar todos os modos de envio disponíveis
ALTER TABLE public.mercado_livre_products
ADD COLUMN IF NOT EXISTS shipping_modes JSONB DEFAULT '[]'::jsonb;

-- 2. Adicionar campo JSONB para armazenar todos os tipos logísticos ME2 disponíveis
ALTER TABLE public.mercado_livre_products
ADD COLUMN IF NOT EXISTS logistic_types JSONB DEFAULT '[]'::jsonb;

-- 3. Criar índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_mercado_livre_products_shipping_modes ON public.mercado_livre_products USING GIN (shipping_modes);
CREATE INDEX IF NOT EXISTS idx_mercado_livre_products_logistic_types ON public.mercado_livre_products USING GIN (logistic_types);

-- 4. Atualizar produtos existentes: migrar shipping_mode e logistic_type para os arrays JSONB
-- Mantém compatibilidade retroativa
UPDATE public.mercado_livre_products
SET 
  shipping_modes = CASE 
    WHEN shipping_mode IS NOT NULL THEN jsonb_build_array(shipping_mode)
    ELSE '[]'::jsonb
  END,
  logistic_types = CASE
    WHEN shipping_mode = 'me2' AND logistic_type IS NOT NULL THEN jsonb_build_array(logistic_type)
    ELSE '[]'::jsonb
  END
WHERE shipping_modes = '[]'::jsonb OR shipping_modes IS NULL;

-- 5. Comentários para documentação
COMMENT ON COLUMN public.mercado_livre_products.shipping_modes IS 'Array JSONB com todos os modos de envio disponíveis para o produto (ex: ["me2", "custom"])';
COMMENT ON COLUMN public.mercado_livre_products.logistic_types IS 'Array JSONB com todos os tipos logísticos ME2 disponíveis (ex: ["self_service", "xd_drop_off"])';

