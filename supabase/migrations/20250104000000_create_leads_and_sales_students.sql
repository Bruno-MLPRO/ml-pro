-- Migration: Create leads and sales_students tables for Hub de Aquisição

-- Table: leads (Pipeline de Leads)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  origem TEXT NOT NULL CHECK (origem IN ('Copping', 'Centralize', 'Indicação', 'Instagram', 'Youtube', 'Outro')),
  origem_outro TEXT, -- Quando origem = 'Outro'
  status TEXT NOT NULL DEFAULT 'Novo' CHECK (status IN ('Novo', 'Em Contato', 'Qualificado', 'Nutrição', 'Convertido', 'Desqualificado')),
  closer_responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_ultima_interacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  lead_score INTEGER DEFAULT 0,
  logs_de_interacao TEXT,
  
  -- Dados da venda (quando status = Convertido)
  produto_vendido TEXT,
  valor_pago DECIMAL(10, 2),
  forma_pagamento TEXT,
  data_inicio DATE,
  gestor_responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  observacoes_closer TEXT,
  
  -- Controle
  convertido_em_aluno BOOLEAN DEFAULT FALSE,
  arquivado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: sales_students (Alunos em Onboarding - Gestão de Alunos)
CREATE TABLE IF NOT EXISTS sales_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Link para o usuário criado no sistema
  
  -- Dados básicos (copiados do lead)
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  instagram TEXT,
  localizacao TEXT,
  
  -- Dados de negócio
  tem_cnpj BOOLEAN DEFAULT FALSE,
  regime_cnpj TEXT, -- MEI, Simples Nacional, etc.
  usa_centralize BOOLEAN DEFAULT FALSE,
  tem_contador BOOLEAN DEFAULT FALSE,
  nome_contador TEXT,
  ja_vende BOOLEAN DEFAULT FALSE,
  faturamento_mensal DECIMAL(10, 2),
  investimento_estoque DECIMAL(10, 2),
  meta_faturamento DECIMAL(10, 2),
  
  -- Dados da venda
  gestor_responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  produto_comprado TEXT NOT NULL,
  valor_pago DECIMAL(10, 2) NOT NULL,
  forma_pagamento TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  observacoes_closer TEXT,
  
  -- Checklist de Onboarding
  onb_call_feita BOOLEAN DEFAULT FALSE,
  onb_catalogo_liberado BOOLEAN DEFAULT FALSE,
  onb_memberkit_liberado BOOLEAN DEFAULT FALSE,
  onb_grupos_ok BOOLEAN DEFAULT FALSE,
  onb_fornecedores_ok BOOLEAN DEFAULT FALSE,
  onb_bonus_ok BOOLEAN DEFAULT FALSE,
  
  -- Atualizações/Anotações
  atualizacoes TEXT,
  
  -- Controle
  usuario_criado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_leads_status ON leads(status) WHERE NOT arquivado;
CREATE INDEX idx_leads_closer ON leads(closer_responsavel_id) WHERE NOT arquivado;
CREATE INDEX idx_leads_origem ON leads(origem);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

CREATE INDEX idx_sales_students_gestor ON sales_students(gestor_responsavel_id);
CREATE INDEX idx_sales_students_lead ON sales_students(lead_id);
CREATE INDEX idx_sales_students_user ON sales_students(user_id);
CREATE INDEX idx_sales_students_data_inicio ON sales_students(data_inicio DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_students_updated_at
  BEFORE UPDATE ON sales_students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar data_ultima_interacao em leads
CREATE OR REPLACE FUNCTION update_lead_last_interaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.logs_de_interacao IS DISTINCT FROM OLD.logs_de_interacao THEN
    NEW.data_ultima_interacao = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lead_interaction_timestamp
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_last_interaction();

-- RLS Policies

-- Leads: Apenas administradores podem ver e gerenciar
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administrators can view all leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

CREATE POLICY "Administrators can insert leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

CREATE POLICY "Administrators can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

CREATE POLICY "Administrators can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

-- Sales Students: Apenas administradores podem ver e gerenciar
ALTER TABLE sales_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administrators can view all sales students"
  ON sales_students FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

CREATE POLICY "Administrators can insert sales students"
  ON sales_students FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

CREATE POLICY "Administrators can update sales students"
  ON sales_students FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

CREATE POLICY "Administrators can delete sales students"
  ON sales_students FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'administrator'
    )
  );

-- Comentários nas tabelas
COMMENT ON TABLE leads IS 'Pipeline de leads para o Hub de Aquisição';
COMMENT ON TABLE sales_students IS 'Alunos em processo de onboarding (leads convertidos)';
COMMENT ON COLUMN leads.convertido_em_aluno IS 'Indica se o lead foi convertido em sales_student';
COMMENT ON COLUMN sales_students.usuario_criado IS 'Indica se o usuário foi criado no sistema (profiles + auth)';

