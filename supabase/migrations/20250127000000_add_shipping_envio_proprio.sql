-- Adicionar campo shipping_envio_proprio nas tabelas de métricas mensais
-- Separando Correios (custom) de Envio Próprio (not_specified)

-- 1. Adicionar campo na tabela student_monthly_metrics
ALTER TABLE public.student_monthly_metrics
ADD COLUMN IF NOT EXISTS shipping_envio_proprio INTEGER DEFAULT 0;

-- 2. Adicionar campo na tabela consolidated_metrics_monthly
ALTER TABLE public.consolidated_metrics_monthly
ADD COLUMN IF NOT EXISTS shipping_envio_proprio INTEGER DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN public.student_monthly_metrics.shipping_envio_proprio IS 'Produtos com shipping_mode = not_specified (vendedor entra em contato)';
COMMENT ON COLUMN public.consolidated_metrics_monthly.shipping_envio_proprio IS 'Produtos com shipping_mode = not_specified (vendedor entra em contato)';

