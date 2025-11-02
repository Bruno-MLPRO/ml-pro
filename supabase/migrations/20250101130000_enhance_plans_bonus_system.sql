-- ============================================================================
-- MELHORIAS NO SISTEMA DE PLANOS E BÔNUS
-- Integração com Sistema Financeiro
-- ============================================================================

-- ============================================================================
-- 1. ATUALIZAR TABELA DE BÔNUS COM CUSTOS
-- ============================================================================

DO $$ 
BEGIN
  -- Adicionar campo de custo aos bônus
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bonus' AND column_name='cost') THEN
    ALTER TABLE bonus ADD COLUMN cost NUMERIC DEFAULT 0;
  END IF;
  
  -- Adicionar categoria do bônus
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bonus' AND column_name='category') THEN
    ALTER TABLE bonus ADD COLUMN category TEXT DEFAULT 'material';
  END IF;
  
  -- Adicionar se é único ou recorrente
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bonus' AND column_name='is_recurring') THEN
    ALTER TABLE bonus ADD COLUMN is_recurring BOOLEAN DEFAULT false;
  END IF;
  
  -- Adicionar frequência de recorrência
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bonus' AND column_name='recurrence_frequency') THEN
    ALTER TABLE bonus ADD COLUMN recurrence_frequency TEXT;
  END IF;
END $$;

-- Adicionar comentários
COMMENT ON COLUMN bonus.cost IS 'Custo para fornecer este bônus ao aluno';
COMMENT ON COLUMN bonus.category IS 'Categoria: material, ferramenta, curso, mentoria, evento, outros';
COMMENT ON COLUMN bonus.is_recurring IS 'Se o custo é recorrente (ex: assinatura de ferramenta)';
COMMENT ON COLUMN bonus.recurrence_frequency IS 'Frequência da recorrência: monthly, yearly';

-- ============================================================================
-- 2. MELHORAR TABELA DE ENTREGA DE BÔNUS
-- ============================================================================

DO $$ 
BEGIN
  -- Adicionar custo no momento da entrega (pode ser diferente do cadastrado)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='student_bonus_delivery' AND column_name='delivery_cost') THEN
    ALTER TABLE student_bonus_delivery ADD COLUMN delivery_cost NUMERIC DEFAULT 0;
  END IF;
  
  -- Adicionar observações sobre a entrega
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='student_bonus_delivery' AND column_name='notes') THEN
    ALTER TABLE student_bonus_delivery ADD COLUMN notes TEXT;
  END IF;
  
  -- Adicionar link para o fluxo de caixa (se gerou despesa)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='student_bonus_delivery' AND column_name='cash_flow_entry_id') THEN
    ALTER TABLE student_bonus_delivery ADD COLUMN cash_flow_entry_id UUID REFERENCES public.cash_flow_entries(id);
  END IF;
END $$;

-- ============================================================================
-- 3. CRIAR TABELA DE CUSTOS ASSOCIADOS AOS PLANOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plan_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  
  -- Descrição do custo
  description TEXT NOT NULL,
  cost_type TEXT NOT NULL, -- setup, monthly, per_student, one_time
  
  -- Valor
  amount NUMERIC NOT NULL,
  
  -- Categoria da despesa
  category TEXT NOT NULL, -- material, ferramenta, infraestrutura, etc
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_cost_type CHECK (cost_type IN ('setup', 'monthly', 'per_student', 'one_time'))
);

CREATE INDEX idx_plan_costs_plan_id ON public.plan_costs(plan_id);

COMMENT ON TABLE public.plan_costs IS 'Custos operacionais associados a cada plano';
COMMENT ON COLUMN public.plan_costs.cost_type IS 'setup: custo inicial, monthly: custo mensal fixo, per_student: custo por aluno, one_time: custo único';

-- ============================================================================
-- 4. CRIAR VIEW DE LUCRATIVIDADE POR PLANO
-- ============================================================================

CREATE OR REPLACE VIEW public.plan_profitability AS
SELECT 
  p.id as plan_id,
  p.name as plan_name,
  p.price as plan_price,
  p.current_students,
  
  -- Receita
  (p.price * p.current_students) as monthly_revenue,
  
  -- Custos
  COALESCE(SUM(CASE WHEN pc.cost_type = 'monthly' THEN pc.amount ELSE 0 END), 0) as fixed_monthly_costs,
  COALESCE(SUM(CASE WHEN pc.cost_type = 'per_student' THEN pc.amount * p.current_students ELSE 0 END), 0) as variable_costs,
  
  -- Lucro
  (p.price * p.current_students) - 
  COALESCE(SUM(CASE WHEN pc.cost_type = 'monthly' THEN pc.amount ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN pc.cost_type = 'per_student' THEN pc.amount * p.current_students ELSE 0 END), 0) as monthly_profit,
  
  -- Margem
  CASE 
    WHEN (p.price * p.current_students) > 0 THEN
      ((p.price * p.current_students) - 
       COALESCE(SUM(CASE WHEN pc.cost_type = 'monthly' THEN pc.amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN pc.cost_type = 'per_student' THEN pc.amount * p.current_students ELSE 0 END), 0)) / 
      (p.price * p.current_students) * 100
    ELSE 0 
  END as profit_margin_percentage
  
FROM public.plans p
LEFT JOIN public.plan_costs pc ON p.id = pc.plan_id AND pc.is_active = true
WHERE p.is_active = true
GROUP BY p.id, p.name, p.price, p.current_students;

-- ============================================================================
-- 5. FUNÇÃO PARA REGISTRAR ENTREGA DE BÔNUS NO FLUXO DE CAIXA
-- ============================================================================

CREATE OR REPLACE FUNCTION register_bonus_delivery_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_bonus_name TEXT;
  v_bonus_cost NUMERIC;
  v_student_name TEXT;
  v_cash_flow_id UUID;
  v_bonus_category TEXT;
BEGIN
  -- Buscar informações do bônus
  SELECT name, cost, category INTO v_bonus_name, v_bonus_cost, v_bonus_category
  FROM public.bonus
  WHERE id = NEW.bonus_id;
  
  -- Buscar nome do aluno
  SELECT full_name INTO v_student_name
  FROM public.profiles
  WHERE id = NEW.student_id;
  
  -- Se o custo for maior que 0, registrar no fluxo de caixa
  IF COALESCE(NEW.delivery_cost, v_bonus_cost, 0) > 0 THEN
    -- Buscar categoria de fluxo de caixa
    DECLARE
      v_category_id UUID;
    BEGIN
      SELECT id INTO v_category_id
      FROM public.cash_flow_categories
      WHERE name = 'Bônus para Alunos'
      LIMIT 1;
      
      -- Criar entrada no fluxo de caixa
      INSERT INTO public.cash_flow_entries (
        type,
        category_id,
        category_name,
        title,
        description,
        amount,
        date,
        related_to_type,
        related_to_id,
        related_to_name,
        payment_status,
        tags
      ) VALUES (
        'expense',
        v_category_id,
        'Bônus para Alunos',
        'Bônus: ' || v_bonus_name,
        'Entrega de bônus para ' || v_student_name,
        COALESCE(NEW.delivery_cost, v_bonus_cost),
        NEW.delivered_at::DATE,
        'student',
        NEW.student_id,
        v_student_name,
        'confirmed',
        ARRAY[v_bonus_category, 'bonus']
      ) RETURNING id INTO v_cash_flow_id;
      
      -- Atualizar a entrega com o ID do fluxo de caixa
      NEW.cash_flow_entry_id := v_cash_flow_id;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para registrar automaticamente no fluxo de caixa
DROP TRIGGER IF EXISTS trigger_bonus_delivery_expense ON public.student_bonus_delivery;
CREATE TRIGGER trigger_bonus_delivery_expense
  BEFORE INSERT ON public.student_bonus_delivery
  FOR EACH ROW
  EXECUTE FUNCTION register_bonus_delivery_expense();

-- ============================================================================
-- 6. FUNÇÃO PARA ATUALIZAR CONTADOR DE ALUNOS NO PLANO
-- ============================================================================

CREATE OR REPLACE FUNCTION update_plan_student_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar contador quando assinatura for criada ou atualizada
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.plan_id IS DISTINCT FROM NEW.plan_id) THEN
    -- Incrementar no novo plano
    IF NEW.plan_id IS NOT NULL AND NEW.status = 'active' THEN
      UPDATE public.plans
      SET current_students = (
        SELECT COUNT(*) 
        FROM public.student_subscriptions 
        WHERE plan_id = NEW.plan_id AND status = 'active'
      )
      WHERE id = NEW.plan_id;
    END IF;
    
    -- Decrementar no plano antigo (se houver update)
    IF TG_OP = 'UPDATE' AND OLD.plan_id IS NOT NULL THEN
      UPDATE public.plans
      SET current_students = (
        SELECT COUNT(*) 
        FROM public.student_subscriptions 
        WHERE plan_id = OLD.plan_id AND status = 'active'
      )
      WHERE id = OLD.plan_id;
    END IF;
  END IF;
  
  -- Decrementar quando status mudar para inativo
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status != 'active' THEN
    IF NEW.plan_id IS NOT NULL THEN
      UPDATE public.plans
      SET current_students = (
        SELECT COUNT(*) 
        FROM public.student_subscriptions 
        WHERE plan_id = NEW.plan_id AND status = 'active'
      )
      WHERE id = NEW.plan_id;
    END IF;
  END IF;
  
  -- Incrementar quando status mudar para ativo
  IF TG_OP = 'UPDATE' AND OLD.status != 'active' AND NEW.status = 'active' THEN
    IF NEW.plan_id IS NOT NULL THEN
      UPDATE public.plans
      SET current_students = (
        SELECT COUNT(*) 
        FROM public.student_subscriptions 
        WHERE plan_id = NEW.plan_id AND status = 'active'
      )
      WHERE id = NEW.plan_id;
    END IF;
  END IF;
  
  -- Decrementar quando assinatura for deletada
  IF TG_OP = 'DELETE' AND OLD.status = 'active' AND OLD.plan_id IS NOT NULL THEN
    UPDATE public.plans
    SET current_students = (
      SELECT COUNT(*) 
      FROM public.student_subscriptions 
      WHERE plan_id = OLD.plan_id AND status = 'active'
    )
    WHERE id = OLD.plan_id;
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar contador
DROP TRIGGER IF EXISTS trigger_update_plan_student_count ON public.student_subscriptions;
CREATE TRIGGER trigger_update_plan_student_count
  AFTER INSERT OR UPDATE OR DELETE ON public.student_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_student_count();

-- ============================================================================
-- 7. FUNÇÃO PARA GERAR COBRANÇA AUTOMÁTICA NO FLUXO DE CAIXA
-- ============================================================================

CREATE OR REPLACE FUNCTION register_subscription_payment_income()
RETURNS TRIGGER AS $$
DECLARE
  v_student_name TEXT;
  v_plan_name TEXT;
  v_cash_flow_id UUID;
BEGIN
  -- Apenas registrar quando o pagamento for confirmado
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Buscar informações
    SELECT 
      p.full_name,
      pl.name
    INTO v_student_name, v_plan_name
    FROM public.student_subscriptions ss
    JOIN public.profiles p ON p.id = ss.student_id
    LEFT JOIN public.plans pl ON pl.id = ss.plan_id
    WHERE ss.id = NEW.subscription_id;
    
    -- Buscar categoria de receita
    DECLARE
      v_category_id UUID;
    BEGIN
      SELECT id INTO v_category_id
      FROM public.cash_flow_categories
      WHERE name = 'Assinaturas de Alunos'
      LIMIT 1;
      
      -- Criar entrada de receita no fluxo de caixa
      INSERT INTO public.cash_flow_entries (
        type,
        category_id,
        category_name,
        title,
        description,
        amount,
        date,
        related_to_type,
        related_to_id,
        related_to_name,
        payment_method,
        payment_status,
        transaction_id,
        tags
      ) VALUES (
        'income',
        v_category_id,
        'Assinaturas de Alunos',
        'Mensalidade: ' || COALESCE(v_plan_name, 'Plano'),
        'Pagamento de ' || v_student_name,
        NEW.final_amount,
        NEW.paid_date,
        'subscription',
        NEW.subscription_id,
        v_student_name,
        NEW.payment_method,
        'confirmed',
        NEW.transaction_id,
        ARRAY['mensalidade', 'recorrente']
      ) RETURNING id INTO v_cash_flow_id;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para registrar receita automaticamente
DROP TRIGGER IF EXISTS trigger_subscription_payment_income ON public.subscription_payments;
CREATE TRIGGER trigger_subscription_payment_income
  AFTER INSERT OR UPDATE ON public.subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION register_subscription_payment_income();

-- ============================================================================
-- 8. RLS POLICIES PARA NOVAS TABELAS
-- ============================================================================

ALTER TABLE public.plan_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins can view plan costs"
  ON public.plan_costs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'administrator')
    )
  );

CREATE POLICY "Admins can manage plan costs"
  ON public.plan_costs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

CREATE POLICY "Service role full access plan costs" 
  ON public.plan_costs FOR ALL 
  TO service_role 
  USING (true);

-- ============================================================================
-- 9. DADOS EXEMPLO (OPCIONAL - DESCOMENTAR SE QUISER)
-- ============================================================================

/*
-- Inserir custos exemplo para planos (se existirem)
INSERT INTO public.plan_costs (plan_id, description, cost_type, amount, category)
SELECT 
  id,
  'Materiais de Mentoria',
  'per_student',
  50.00,
  'material'
FROM public.plans
WHERE is_active = true
ON CONFLICT DO NOTHING;

-- Atualizar custos de bônus existentes
UPDATE public.bonus 
SET cost = 100.00, category = 'material'
WHERE cost IS NULL OR cost = 0;
*/

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================

