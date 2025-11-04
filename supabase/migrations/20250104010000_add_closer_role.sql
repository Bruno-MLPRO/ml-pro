-- Migration: Add 'closer' role and update RLS policies for leads

-- Atualizar o check constraint da tabela user_roles para incluir 'closer'
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check 
  CHECK (role IN ('student', 'manager', 'administrator', 'closer'));

-- Comentário
COMMENT ON TABLE user_roles IS 'Roles disponíveis: student, manager, administrator, closer';

-- Atualizar RLS Policies para permitir que Closers gerenciem leads

-- Closers podem visualizar leads
CREATE POLICY "Closers can view all leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('administrator', 'closer')
    )
  );

-- Closers podem criar leads
CREATE POLICY "Closers can insert leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('administrator', 'closer')
    )
  );

-- Closers podem atualizar leads
CREATE POLICY "Closers can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('administrator', 'closer')
    )
  );

-- Closers NÃO podem deletar leads (apenas administradores)
-- A policy "Administrators can delete leads" já existe e está correta

-- Closers podem visualizar sales_students (apenas leitura)
CREATE POLICY "Closers can view all sales students"
  ON sales_students FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('administrator', 'closer')
    )
  );

-- Comentários
COMMENT ON POLICY "Closers can view all leads" ON leads IS 'Closers podem visualizar todos os leads';
COMMENT ON POLICY "Closers can insert leads" ON leads IS 'Closers podem criar novos leads';
COMMENT ON POLICY "Closers can update leads" ON leads IS 'Closers podem atualizar leads (mover no Kanban, editar, registrar vendas)';
COMMENT ON POLICY "Closers can view all sales students" ON sales_students IS 'Closers podem visualizar alunos em onboarding (apenas leitura)';

