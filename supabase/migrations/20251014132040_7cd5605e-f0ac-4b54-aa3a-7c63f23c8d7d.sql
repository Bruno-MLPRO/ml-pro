-- Criar view segura da tabela mercado_livre_accounts sem expor os tokens
CREATE OR REPLACE VIEW mercado_livre_accounts_safe AS
SELECT 
  id,
  student_id,
  ml_user_id,
  ml_nickname,
  is_primary,
  is_active,
  connected_at,
  last_sync_at,
  token_expires_at,
  created_at,
  updated_at
FROM mercado_livre_accounts;

-- Revogar policies existentes de SELECT na tabela original
DROP POLICY IF EXISTS "Students can view own ML accounts" ON mercado_livre_accounts;
DROP POLICY IF EXISTS "Managers can view all ML accounts" ON mercado_livre_accounts;

-- Criar policy que permite SELECT apenas para edge functions (service role)
-- Bloqueia acesso direto do cliente aos tokens
CREATE POLICY "Only service role can view tokens"
ON mercado_livre_accounts
FOR SELECT
USING (
  -- Permite apenas chamadas do service role (edge functions)
  auth.role() = 'service_role'
);

-- Comentário: A view mercado_livre_accounts_safe herda as permissões da tabela base
-- Como a policy acima bloqueia acesso do cliente, precisamos dar acesso explícito à view

-- Grant permissions na view para authenticated users
GRANT SELECT ON mercado_livre_accounts_safe TO authenticated;

-- Criar function que retorna contas seguras do estudante
CREATE OR REPLACE FUNCTION get_student_ml_accounts_safe(student_uuid uuid)
RETURNS SETOF mercado_livre_accounts_safe
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM mercado_livre_accounts_safe
  WHERE student_id = student_uuid;
$$;

-- Criar function que retorna todas as contas para gestores
CREATE OR REPLACE FUNCTION get_all_ml_accounts_safe()
RETURNS SETOF mercado_livre_accounts_safe
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM mercado_livre_accounts_safe;
$$;