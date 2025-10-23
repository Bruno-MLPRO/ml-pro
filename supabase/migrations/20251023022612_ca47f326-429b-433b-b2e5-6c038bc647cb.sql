-- Criar tabela de métricas consolidadas mensais
CREATE TABLE public.consolidated_metrics_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month DATE NOT NULL, -- Primeiro dia do mês de referência
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Métricas de Vendas
  total_revenue NUMERIC DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  
  -- Métricas de Product Ads (CORRIGIDAS)
  ads_total_spend NUMERIC DEFAULT 0,
  ads_total_revenue NUMERIC DEFAULT 0, -- ad_revenue somado
  ads_total_sales INTEGER DEFAULT 0,
  ads_roas NUMERIC DEFAULT 0, -- Calculado: ads_total_revenue / ads_total_spend
  ads_acos NUMERIC DEFAULT 0, -- Calculado: (ads_total_spend / ads_total_revenue) * 100
  
  -- Anúncios Ativos por Tipo de Envio
  shipping_correios INTEGER DEFAULT 0,
  shipping_flex INTEGER DEFAULT 0,
  shipping_agencias INTEGER DEFAULT 0,
  shipping_coleta INTEGER DEFAULT 0,
  shipping_full INTEGER DEFAULT 0,
  
  -- Metadados
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(reference_month)
);

-- RLS Policies
ALTER TABLE public.consolidated_metrics_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins can view consolidated metrics"
  ON public.consolidated_metrics_monthly
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) 
    OR has_role(auth.uid(), 'administrator'::app_role)
  );

CREATE POLICY "Service role can manage consolidated metrics"
  ON public.consolidated_metrics_monthly
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Índice para performance
CREATE INDEX idx_consolidated_metrics_reference_month 
  ON public.consolidated_metrics_monthly(reference_month DESC);