-- Adicionar campos para detectar e exibir informações do Programa Decola
ALTER TABLE public.mercado_livre_metrics
ADD COLUMN IF NOT EXISTS real_reputation_level text,
ADD COLUMN IF NOT EXISTS protection_end_date timestamp with time zone;

COMMENT ON COLUMN public.mercado_livre_metrics.real_reputation_level IS 'Reputação real do vendedor quando está no Programa Decola (ex: red, yellow)';
COMMENT ON COLUMN public.mercado_livre_metrics.protection_end_date IS 'Data de término da proteção do Programa Decola';