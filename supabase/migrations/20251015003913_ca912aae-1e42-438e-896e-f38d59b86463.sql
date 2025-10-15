-- Create mercado_livre_item_health table
CREATE TABLE public.mercado_livre_item_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_account_id uuid NOT NULL REFERENCES public.mercado_livre_accounts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  ml_item_id text NOT NULL,
  
  -- Health Score
  health_score numeric NOT NULL,
  health_level text NOT NULL,
  
  -- Goals detalhados (JSON)
  goals jsonb NOT NULL DEFAULT '[]',
  
  -- Métricas de progresso
  goals_completed integer DEFAULT 0,
  goals_applicable integer DEFAULT 0,
  completion_percentage numeric DEFAULT 0,
  
  -- Tracking de melhorias
  previous_score numeric,
  score_trend text,
  
  -- Timestamps
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(ml_account_id, ml_item_id)
);

-- Create indexes for performance
CREATE INDEX idx_ml_item_health_account ON public.mercado_livre_item_health(ml_account_id);
CREATE INDEX idx_ml_item_health_student ON public.mercado_livre_item_health(student_id);
CREATE INDEX idx_ml_item_health_score ON public.mercado_livre_item_health(health_score);
CREATE INDEX idx_ml_item_health_level ON public.mercado_livre_item_health(health_level);

-- Enable RLS
ALTER TABLE public.mercado_livre_item_health ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Students can view own item health"
  ON public.mercado_livre_item_health FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Managers can view all item health"
  ON public.mercado_livre_item_health FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Create mercado_livre_health_history table
CREATE TABLE public.mercado_livre_health_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_item_id text NOT NULL,
  ml_account_id uuid NOT NULL,
  student_id uuid NOT NULL,
  health_score numeric NOT NULL,
  health_level text NOT NULL,
  recorded_at timestamptz DEFAULT now()
);

-- Create indexes for history
CREATE INDEX idx_ml_health_history_item ON public.mercado_livre_health_history(ml_item_id);
CREATE INDEX idx_ml_health_history_account ON public.mercado_livre_health_history(ml_account_id);
CREATE INDEX idx_ml_health_history_date ON public.mercado_livre_health_history(recorded_at);

-- Enable RLS on history
ALTER TABLE public.mercado_livre_health_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for history
CREATE POLICY "Students can view own health history"
  ON public.mercado_livre_health_history FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Managers can view all health history"
  ON public.mercado_livre_health_history FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Enable realtime for item health (for toast alerts)
ALTER PUBLICATION supabase_realtime ADD TABLE public.mercado_livre_item_health;