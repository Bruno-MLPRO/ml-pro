-- ============================================================================
-- FASE 1: GESTÃO FINANCEIRA - Sistema Completo
-- ============================================================================

-- ============================================================================
-- 1. PLANOS E ASSINATURAS
-- ============================================================================

-- Expandir tabela de planos existente (se necessário adicionar campos)
-- Verificar se a tabela plans já existe e adicionar campos novos
DO $$ 
BEGIN
  -- Adicionar campos novos apenas se não existirem
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='plans' AND column_name='target_audience') THEN
    ALTER TABLE plans ADD COLUMN target_audience TEXT DEFAULT 'geral';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='plans' AND column_name='max_students') THEN
    ALTER TABLE plans ADD COLUMN max_students INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='plans' AND column_name='current_students') THEN
    ALTER TABLE plans ADD COLUMN current_students INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='plans' AND column_name='discount_percentage') THEN
    ALTER TABLE plans ADD COLUMN discount_percentage NUMERIC DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='plans' AND column_name='promotion_end_date') THEN
    ALTER TABLE plans ADD COLUMN promotion_end_date DATE;
  END IF;
END $$;

-- Tabela de Assinaturas de Alunos
CREATE TABLE IF NOT EXISTS public.student_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  
  -- Datas
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  
  -- Valores
  monthly_price NUMERIC NOT NULL,
  payment_day INTEGER NOT NULL DEFAULT 10, -- Dia do mês para cobrança (1-28)
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active',
  -- active: ativa e em dia
  -- paused: pausada temporariamente
  -- cancelled: cancelada pelo aluno
  -- expired: expirou (não renovada)
  -- overdue: inadimplente
  
  -- Pagamento
  payment_method TEXT DEFAULT 'credit_card',
  -- credit_card, pix, boleto, bank_transfer
  
  auto_renewal BOOLEAN DEFAULT true,
  
  -- Observações
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_payment_day CHECK (payment_day >= 1 AND payment_day <= 28),
  CONSTRAINT valid_status CHECK (status IN ('active', 'paused', 'cancelled', 'expired', 'overdue'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_student_subscriptions_student_id ON public.student_subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subscriptions_status ON public.student_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_student_subscriptions_start_date ON public.student_subscriptions(start_date DESC);

-- Tabela de Pagamentos de Assinaturas
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.student_subscriptions(id) ON DELETE CASCADE,
  
  -- Datas
  due_date DATE NOT NULL,
  paid_date DATE,
  
  -- Valores
  amount NUMERIC NOT NULL,
  discount_amount NUMERIC DEFAULT 0,
  final_amount NUMERIC NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending: aguardando pagamento
  -- paid: pago
  -- overdue: atrasado
  -- cancelled: cancelado
  -- refunded: estornado
  
  -- Pagamento
  payment_method TEXT,
  transaction_id TEXT,
  payment_proof_url TEXT,
  
  -- Observações
  notes TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_payment_status CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id ON public.subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON public.subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_due_date ON public.subscription_payments(due_date DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_paid_date ON public.subscription_payments(paid_date DESC);

-- ============================================================================
-- 2. FLUXO DE CAIXA
-- ============================================================================

-- Categorias de Fluxo de Caixa (enum-like)
CREATE TABLE IF NOT EXISTS public.cash_flow_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- income, expense
  description TEXT,
  icon TEXT, -- Nome do ícone lucide-react
  color TEXT, -- Cor em hex
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_category_type CHECK (type IN ('income', 'expense'))
);

-- Inserir categorias padrão
INSERT INTO public.cash_flow_categories (name, type, description, icon, color) VALUES
  ('Assinaturas de Alunos', 'income', 'Pagamentos mensais dos alunos', 'Users', '#10b981'),
  ('Matrículas', 'income', 'Taxas de matrícula/setup inicial', 'UserPlus', '#3b82f6'),
  ('Bônus e Upgrades', 'income', 'Vendas de conteúdo extra', 'Gift', '#8b5cf6'),
  ('Outros Recebimentos', 'income', 'Outras receitas', 'DollarSign', '#06b6d4'),
  
  ('Salários - Gestores', 'expense', 'Pagamento de gestores', 'Briefcase', '#ef4444'),
  ('Salários - Equipe', 'expense', 'Pagamento de equipe administrativa', 'Users', '#f97316'),
  ('Ferramentas e Apps', 'expense', 'Softwares, apps, extensões', 'Wrench', '#f59e0b'),
  ('Infraestrutura', 'expense', 'Supabase, Vercel, domínios, hosting', 'Server', '#ec4899'),
  ('Marketing e Publicidade', 'expense', 'Anúncios, campanhas, marketing', 'Megaphone', '#8b5cf6'),
  ('Materiais de Mentoria', 'expense', 'Cursos, conteúdos, materiais educacionais', 'BookOpen', '#6366f1'),
  ('Bônus para Alunos', 'expense', 'Bônus, prêmios, incentivos', 'Gift', '#14b8a6'),
  ('Impostos e Taxas', 'expense', 'Impostos, taxas governamentais', 'FileText', '#64748b'),
  ('Manutenção e Suporte', 'expense', 'Manutenção, suporte técnico', 'Settings', '#71717a'),
  ('Outras Despesas', 'expense', 'Despesas diversas', 'CreditCard', '#6b7280')
ON CONFLICT (name) DO NOTHING;

-- Tabela Principal de Fluxo de Caixa
CREATE TABLE IF NOT EXISTS public.cash_flow_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo e Categoria
  type TEXT NOT NULL, -- income, expense
  category_id UUID REFERENCES public.cash_flow_categories(id) ON DELETE SET NULL,
  category_name TEXT, -- Cache do nome (caso categoria seja deletada)
  
  -- Descrição
  title TEXT NOT NULL,
  description TEXT,
  
  -- Valor
  amount NUMERIC NOT NULL,
  
  -- Data
  date DATE NOT NULL,
  
  -- Recorrência
  is_recurring BOOLEAN DEFAULT false,
  recurrence_frequency TEXT, -- monthly, weekly, yearly, quarterly, custom
  recurrence_interval INTEGER DEFAULT 1, -- A cada X períodos
  recurrence_end_date DATE, -- Data final da recorrência (opcional)
  parent_entry_id UUID REFERENCES public.cash_flow_entries(id), -- Se for gerada por recorrência
  
  -- Relacionamento (opcional)
  related_to_type TEXT, -- student, manager, general, subscription
  related_to_id UUID, -- ID do relacionado (student_id, manager_id, subscription_id)
  related_to_name TEXT, -- Nome do relacionado (cache)
  
  -- Pagamento
  payment_method TEXT, -- cash, credit_card, debit_card, pix, bank_transfer, boleto
  payment_status TEXT NOT NULL DEFAULT 'confirmed', -- pending, confirmed, cancelled
  transaction_id TEXT,
  
  -- Comprovante
  receipt_url TEXT,
  
  -- Observações
  notes TEXT,
  tags TEXT[], -- Tags para filtros
  
  -- Metadados
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_entry_type CHECK (type IN ('income', 'expense')),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('pending', 'confirmed', 'cancelled')),
  CONSTRAINT valid_recurrence_frequency CHECK (
    recurrence_frequency IS NULL OR 
    recurrence_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_type ON public.cash_flow_entries(type);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_category_id ON public.cash_flow_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_date ON public.cash_flow_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_payment_status ON public.cash_flow_entries(payment_status);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_is_recurring ON public.cash_flow_entries(is_recurring);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_related_to ON public.cash_flow_entries(related_to_type, related_to_id);

-- ============================================================================
-- 3. SALÁRIOS E COMISSÕES (GESTORES)
-- ============================================================================

-- Configuração de Salários de Gestores
CREATE TABLE IF NOT EXISTS public.manager_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Valores
  base_salary NUMERIC NOT NULL DEFAULT 0,
  commission_percentage NUMERIC DEFAULT 0, -- % sobre receita dos alunos sob gestão
  
  -- Periodicidade
  payment_day INTEGER NOT NULL DEFAULT 5, -- Dia do mês para pagamento
  
  -- Período de validade
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive
  
  -- Observações
  notes TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_salary_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT valid_salary_payment_day CHECK (payment_day >= 1 AND payment_day <= 28)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_manager_salaries_manager_id ON public.manager_salaries(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_salaries_status ON public.manager_salaries(status);

-- Histórico de Pagamentos de Salários
CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_salary_id UUID NOT NULL REFERENCES public.manager_salaries(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Período de referência
  reference_month DATE NOT NULL, -- Primeiro dia do mês de referência
  
  -- Valores
  base_salary NUMERIC NOT NULL,
  commission_amount NUMERIC DEFAULT 0,
  bonus_amount NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  
  -- Cálculo de comissão
  total_students_revenue NUMERIC DEFAULT 0, -- Receita total dos alunos no período
  
  -- Datas
  due_date DATE NOT NULL,
  paid_date DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
  
  -- Pagamento
  payment_method TEXT,
  transaction_id TEXT,
  
  -- Observações
  notes TEXT,
  calculation_details JSONB, -- Detalhes do cálculo
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_salary_payment_status CHECK (status IN ('pending', 'paid', 'cancelled'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_salary_payments_manager_id ON public.salary_payments(manager_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_reference_month ON public.salary_payments(reference_month DESC);
CREATE INDEX IF NOT EXISTS idx_salary_payments_status ON public.salary_payments(status);

-- ============================================================================
-- 4. METAS E OBJETIVOS FINANCEIROS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Meta
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL, -- mrr, revenue, students, profit_margin, expense_reduction
  
  -- Valores
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  
  -- Período
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- active, achieved, failed, cancelled
  
  -- Metadados
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_goal_status CHECK (status IN ('active', 'achieved', 'failed', 'cancelled'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_financial_goals_status ON public.financial_goals(status);
CREATE INDEX IF NOT EXISTS idx_financial_goals_end_date ON public.financial_goals(end_date);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Student Subscriptions
ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own subscriptions"
  ON public.student_subscriptions FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Managers and admins can view all subscriptions"
  ON public.student_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'administrator')
    )
  );

CREATE POLICY "Admins can manage subscriptions"
  ON public.student_subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

-- Subscription Payments
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own subscription payments"
  ON public.subscription_payments FOR SELECT
  TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM public.student_subscriptions
      WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Managers and admins can view all payments"
  ON public.subscription_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'administrator')
    )
  );

CREATE POLICY "Admins can manage payments"
  ON public.subscription_payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

-- Cash Flow Categories
ALTER TABLE public.cash_flow_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view categories"
  ON public.cash_flow_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.cash_flow_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

-- Cash Flow Entries
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins can view cash flow"
  ON public.cash_flow_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'administrator')
    )
  );

CREATE POLICY "Admins can manage cash flow"
  ON public.cash_flow_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

-- Manager Salaries
ALTER TABLE public.manager_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view own salary config"
  ON public.manager_salaries FOR SELECT
  TO authenticated
  USING (manager_id = auth.uid());

CREATE POLICY "Admins can manage salaries"
  ON public.manager_salaries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

-- Salary Payments
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view own salary payments"
  ON public.salary_payments FOR SELECT
  TO authenticated
  USING (manager_id = auth.uid());

CREATE POLICY "Admins can manage salary payments"
  ON public.salary_payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

-- Financial Goals
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins can view goals"
  ON public.financial_goals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'administrator')
    )
  );

CREATE POLICY "Admins can manage goals"
  ON public.financial_goals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

-- Service role tem acesso total
CREATE POLICY "Service role full access subscriptions" ON public.student_subscriptions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access payments" ON public.subscription_payments FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access cash flow" ON public.cash_flow_entries FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access salaries" ON public.manager_salaries FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access salary payments" ON public.salary_payments FOR ALL TO service_role USING (true);

-- ============================================================================
-- 6. FUNÇÕES E TRIGGERS
-- ============================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_student_subscriptions_updated_at BEFORE UPDATE ON public.student_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_payments_updated_at BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cash_flow_entries_updated_at BEFORE UPDATE ON public.cash_flow_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manager_salaries_updated_at BEFORE UPDATE ON public.manager_salaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salary_payments_updated_at BEFORE UPDATE ON public.salary_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular final_amount em subscription_payments
CREATE OR REPLACE FUNCTION calculate_final_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.final_amount := NEW.amount - COALESCE(NEW.discount_amount, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_subscription_payment_final_amount 
  BEFORE INSERT OR UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION calculate_final_amount();

-- ============================================================================
-- 7. VIEWS ÚTEIS
-- ============================================================================

-- View de MRR (Monthly Recurring Revenue)
CREATE OR REPLACE VIEW public.mrr_calculation AS
SELECT 
  DATE_TRUNC('month', CURRENT_DATE) as month,
  COUNT(DISTINCT ss.student_id) as active_students,
  SUM(ss.monthly_price) as mrr,
  AVG(ss.monthly_price) as avg_price_per_student
FROM public.student_subscriptions ss
WHERE ss.status = 'active'
GROUP BY DATE_TRUNC('month', CURRENT_DATE);

-- View de Receitas e Despesas Mensais
CREATE OR REPLACE VIEW public.monthly_cash_flow_summary AS
SELECT 
  DATE_TRUNC('month', date) as month,
  type,
  SUM(amount) as total_amount,
  COUNT(*) as transaction_count
FROM public.cash_flow_entries
WHERE payment_status = 'confirmed'
GROUP BY DATE_TRUNC('month', date), type
ORDER BY month DESC, type;

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================

COMMENT ON TABLE public.student_subscriptions IS 'Assinaturas de alunos nos planos da mentoria';
COMMENT ON TABLE public.subscription_payments IS 'Histórico de pagamentos das assinaturas';
COMMENT ON TABLE public.cash_flow_entries IS 'Fluxo de caixa completo (entradas e saídas)';
COMMENT ON TABLE public.cash_flow_categories IS 'Categorias para classificação do fluxo de caixa';
COMMENT ON TABLE public.manager_salaries IS 'Configuração de salários e comissões dos gestores';
COMMENT ON TABLE public.salary_payments IS 'Histórico de pagamentos de salários';
COMMENT ON TABLE public.financial_goals IS 'Metas e objetivos financeiros';

