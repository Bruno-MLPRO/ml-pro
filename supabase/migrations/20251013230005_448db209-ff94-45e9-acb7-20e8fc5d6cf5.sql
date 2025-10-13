-- Adicionar coluna para contador de problemas do Programa Decola
ALTER TABLE public.mercado_livre_metrics
ADD COLUMN IF NOT EXISTS decola_problems_count integer DEFAULT 0;

COMMENT ON COLUMN public.mercado_livre_metrics.decola_problems_count 
IS 'Contador de problemas no Decola (claims + delays + cancellations). Limite: 5 problemas para perder a proteção';