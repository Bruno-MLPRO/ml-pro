-- Criar tabela para armazenar métricas mensais consolidadas dos alunos
CREATE TABLE IF NOT EXISTS public.student_monthly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Métricas de vendas
  total_revenue NUMERIC(12, 2) DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  average_ticket NUMERIC(12, 2) DEFAULT 0,
  
  -- Métricas de Product Ads
  ads_total_spend NUMERIC(12, 2) DEFAULT 0,
  ads_total_revenue NUMERIC(12, 2) DEFAULT 0,
  ads_total_sales INTEGER DEFAULT 0,
  ads_roas NUMERIC(10, 2) DEFAULT 0,
  ads_acos NUMERIC(10, 2) DEFAULT 0,
  
  -- Tipos de envio (snapshot do último dia do mês)
  shipping_correios INTEGER DEFAULT 0,
  shipping_flex INTEGER DEFAULT 0,
  shipping_agencias INTEGER DEFAULT 0,
  shipping_coleta INTEGER DEFAULT 0,
  shipping_full INTEGER DEFAULT 0,
  
  -- Metadados
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: Um registro por aluno por mês
  UNIQUE(student_id, reference_month)
);

-- Índices para performance
CREATE INDEX idx_student_monthly_metrics_student ON public.student_monthly_metrics(student_id);
CREATE INDEX idx_student_monthly_metrics_month ON public.student_monthly_metrics(reference_month);

-- Habilitar RLS
ALTER TABLE public.student_monthly_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Alunos podem ler apenas seus próprios dados
CREATE POLICY "Students can view their own monthly metrics"
  ON public.student_monthly_metrics
  FOR SELECT
  USING (auth.uid() = student_id);

-- Policy: Gestores e Admins podem ler tudo
CREATE POLICY "Managers and admins can view all monthly metrics"
  ON public.student_monthly_metrics
  FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- Policy: Service role pode fazer tudo (para edge function)
CREATE POLICY "Service role can manage monthly metrics"
  ON public.student_monthly_metrics
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_student_monthly_metrics_updated_at
  BEFORE UPDATE ON public.student_monthly_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();