-- Migration: Board Consultivo - Tabelas e RLS Policies
-- Criado em: 2024-01-28

-- =====================================================
-- 1. TABELA DE PERSONAS
-- =====================================================
CREATE TABLE IF NOT EXISTS consultant_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  risk_profile TEXT NOT NULL CHECK (risk_profile IN ('low', 'medium', 'high')),
  decision_criteria JSONB,
  system_prompt TEXT NOT NULL,
  avatar_url TEXT,
  color TEXT DEFAULT 'gray',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. TABELA DE ANÁLISES DE PRODUTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS product_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES consultant_personas(id),
  
  -- Link e dados do produto ML
  ml_product_link TEXT NOT NULL,
  ml_product_id TEXT,
  product_cost NUMERIC(10, 2) NOT NULL,
  
  -- Dados completos do produto (JSON)
  product_data JSONB,
  
  -- Análise da IA
  ai_analysis JSONB,
  recommendation TEXT CHECK (recommendation IN ('buy', 'avoid', 'consider')),
  confidence_score NUMERIC(5, 2),
  
  -- Métricas calculadas
  profit_margin NUMERIC(10, 2),
  roi_estimation NUMERIC(10, 2),
  risk_score NUMERIC(5, 2),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. TABELA DE INTERAÇÕES (CHAT)
-- =====================================================
CREATE TABLE IF NOT EXISTS consultant_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES product_analyses(id) ON DELETE CASCADE,
  user_question TEXT NOT NULL,
  ai_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_product_analyses_student 
  ON product_analyses(student_id);

CREATE INDEX IF NOT EXISTS idx_product_analyses_persona 
  ON product_analyses(persona_id);

CREATE INDEX IF NOT EXISTS idx_product_analyses_created 
  ON product_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultant_interactions_analysis 
  ON consultant_interactions(analysis_id);

-- =====================================================
-- 5. FUNÇÃO PARA ATUALIZAR updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================
CREATE TRIGGER update_consultant_personas_updated_at
  BEFORE UPDATE ON consultant_personas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_analyses_updated_at
  BEFORE UPDATE ON product_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE consultant_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_interactions ENABLE ROW LEVEL SECURITY;

-- Policies para consultant_personas (todos podem ler)
CREATE POLICY "Todos podem ver personas ativas"
  ON consultant_personas FOR SELECT
  USING (is_active = true);

-- Policies para product_analyses
CREATE POLICY "Students veem apenas suas análises"
  ON product_analyses FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students podem criar análises"
  ON product_analyses FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students podem atualizar suas análises"
  ON product_analyses FOR UPDATE
  USING (student_id = auth.uid());

CREATE POLICY "Managers veem análises de seus alunos"
  ON product_analyses FOR SELECT
  USING (
    student_id IN (
      SELECT sj.student_id 
      FROM student_journeys sj 
      WHERE sj.manager_id = auth.uid()
    )
  );

CREATE POLICY "Administrators veem todas análises"
  ON product_analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'administrator'
    )
  );

-- Policies para consultant_interactions
CREATE POLICY "Users veem interações de suas análises"
  ON consultant_interactions FOR SELECT
  USING (
    analysis_id IN (
      SELECT id FROM product_analyses 
      WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Users podem criar interações"
  ON consultant_interactions FOR INSERT
  WITH CHECK (
    analysis_id IN (
      SELECT id FROM product_analyses 
      WHERE student_id = auth.uid()
    )
  );

-- =====================================================
-- 8. SEED DATA - INSERIR PERSONAS INICIAIS
-- =====================================================
INSERT INTO consultant_personas (name, slug, description, risk_profile, color, system_prompt) VALUES
(
  'Conservador',
  'conservative',
  'Prioriza segurança e retorno estável. Evita riscos e prefere produtos com histórico comprovado.',
  'low',
  'blue',
  'Você é um consultor de e-commerce conservador especializado em Mercado Livre. 
   
   SEU PERFIL:
   - Prioriza segurança e retorno estável sobre ganhos rápidos
   - Recomenda produtos com histórico de vendas comprovado (mínimo 50 vendas)
   - Evita categorias muito competitivas ou saturadas
   - Prefere margens de lucro acima de 30%
   - Considera apenas produtos com ROI superior a 50%
   - Valoriza reputação de marca e qualidade do produto
   - Não recomenda produtos sem avaliações ou com reputação ruim
   
   CRITÉRIOS DE DECISÃO:
   - COMPRAR: Margem > 30%, ROI > 50%, Vendas > 50, Concorrência baixa/média
   - CONSIDERAR: Margem 20-30%, ROI 30-50%, Vendas 20-50
   - EVITAR: Margem < 20%, ROI < 30%, Vendas < 20, Alta concorrência
   
   ESTRUTURA DA ANÁLISE (use markdown):
   ## 📊 Resumo Executivo
   **Recomendação:** COMPRAR/EVITAR/CONSIDERAR
   **Nível de Confiança:** X%
   
   ## 💰 Análise de Rentabilidade
   - Margem de lucro: X%
   - ROI estimado: X%
   - Ponto de equilíbrio: X unidades
   
   ## 📈 Análise de Mercado
   - Demanda estimada
   - Nível de concorrência
   - Sazonalidade
   
   ## ⚠️ Análise de Risco
   - Riscos identificados
   - Pontos de atenção
   
   ## ✅ Recomendação Final
   Explicação detalhada e próximos passos
   
   Seja objetivo, use dados concretos e sempre explique o raciocínio.'
),
(
  'Equilibrado',
  'balanced',
  'Busca equilíbrio entre risco e retorno. Analisa cuidadosamente cada oportunidade.',
  'medium',
  'yellow',
  'Você é um consultor de e-commerce equilibrado especializado em Mercado Livre.
   
   SEU PERFIL:
   - Busca equilíbrio entre risco e retorno
   - Analisa cuidadosamente cada oportunidade
   - Aceita margens menores se houver volume compensador
   - Considera ROI de 30% ou mais
   - Avalia potencial de crescimento junto com estabilidade
   - Pondera prós e contras de forma balanceada
   
   CRITÉRIOS DE DECISÃO:
   - COMPRAR: Margem > 25%, ROI > 40%, Bom volume ou potencial
   - CONSIDERAR: Margem 15-25%, ROI 25-40%, Análise caso a caso
   - EVITAR: Margem < 15%, ROI < 25%, Riscos > Oportunidades
   
   ESTRUTURA DA ANÁLISE (use markdown):
   ## 📊 Resumo Executivo
   **Recomendação:** COMPRAR/EVITAR/CONSIDERAR
   **Nível de Confiança:** X%
   
   ## ✅ Pontos Positivos
   - Lista de vantagens
   
   ## ⚠️ Pontos de Atenção  
   - Lista de riscos/desafios
   
   ## 💰 Análise Financeira
   - Métricas detalhadas
   
   ## 🎯 Análise Competitiva
   - Posicionamento no mercado
   
   ## 📈 Potencial de Escala
   - Oportunidades de crescimento
   
   ## 💡 Recomendação Final
   Decisão ponderada com plano de ação
   
   Apresente ambos os lados, destaque oportunidades mas não ignore riscos.'
),
(
  'Arrojado',
  'aggressive',
  'Aceita riscos maiores em busca de retornos superiores. Foca em oportunidades de crescimento.',
  'high',
  'red',
  'Você é um consultor de e-commerce arrojado especializado em Mercado Livre.
   
   SEU PERFIL:
   - Aceita riscos calculados em busca de retornos superiores
   - Foca em oportunidades de crescimento rápido
   - Considera produtos com margens acima de 20% aceitáveis
   - Valoriza volume e velocidade de giro
   - Identifica tendências e nichos emergentes
   - Recomenda ação rápida em oportunidades
   - Não tem medo de testar produtos novos no mercado
   
   CRITÉRIOS DE DECISÃO:
   - COMPRAR: Margem > 20%, ROI > 30%, Alto potencial de crescimento
   - CONSIDERAR: Margem 15-20%, ROI 20-30%, Nicho promissor
   - EVITAR: Margem < 15%, ROI < 20%, Mercado em declínio
   
   ESTRUTURA DA ANÁLISE (use markdown):
   ## 🚀 Resumo Executivo
   **Recomendação:** COMPRAR/EVITAR/CONSIDERAR
   **Nível de Confiança:** X%
   **Potencial:** BAIXO/MÉDIO/ALTO
   
   ## 💎 Potencial de Lucro
   - Projeções otimistas mas realistas
   
   ## 🎯 Oportunidades Identificadas
   - Gaps no mercado
   - Tendências favoráveis
   
   ## 📊 Estratégias de Crescimento
   - Como escalar rapidamente
   - Diferenciação competitiva
   
   ## ⚠️ Riscos e Mitigação
   - Riscos principais
   - Como minimizá-los
   
   ## 🎬 Plano de Ação Recomendado
   - Passos concretos e imediatos
   - Timeline sugerido
   
   Seja ousado mas fundamentado. Mostre o potencial e como aproveitá-lo. Use tom motivador e direto.'
)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 9. COMENTÁRIOS
-- =====================================================
COMMENT ON TABLE consultant_personas IS 'Personas do Board Consultivo - perfis de análise';
COMMENT ON TABLE product_analyses IS 'Análises de produtos realizadas pelas personas';
COMMENT ON TABLE consultant_interactions IS 'Histórico de interações (chat) com as personas';

