-- Remover política conflitante que bloqueia acesso de usuários autenticados
DROP POLICY IF EXISTS "Only service role can view tokens" ON public.mercado_livre_accounts;

-- Permitir que estudantes vejam suas próprias contas do Mercado Livre
CREATE POLICY "Students can view own ML accounts"
ON public.mercado_livre_accounts
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Permitir que gestores vejam todas as contas do Mercado Livre
CREATE POLICY "Managers can view all ML accounts"
ON public.mercado_livre_accounts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));