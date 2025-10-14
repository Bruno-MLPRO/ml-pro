-- Limpeza completa dos dados do usuário brunqcompany@gmail.com
-- User ID: 0c82a4d1-a779-475d-9610-2b61c3098f33

-- 1. Deletar milestones (dependem de student_journeys)
DELETE FROM public.milestones 
WHERE journey_id IN (
  SELECT id FROM public.student_journeys 
  WHERE student_id = '0c82a4d1-a779-475d-9610-2b61c3098f33'
);

-- 2. Deletar student journeys
DELETE FROM public.student_journeys 
WHERE student_id = '0c82a4d1-a779-475d-9610-2b61c3098f33';

-- 3. Deletar webhooks do Mercado Livre
DELETE FROM public.mercado_livre_webhooks 
WHERE ml_account_id IN (
  SELECT id FROM public.mercado_livre_accounts 
  WHERE student_id = '0c82a4d1-a779-475d-9610-2b61c3098f33'
);

-- 4. Deletar estoque FULL do Mercado Livre
DELETE FROM public.mercado_livre_full_stock 
WHERE student_id = '0c82a4d1-a779-475d-9610-2b61c3098f33';

-- 5. Deletar produtos do Mercado Livre
DELETE FROM public.mercado_livre_products 
WHERE student_id = '0c82a4d1-a779-475d-9610-2b61c3098f33';

-- 6. Deletar pedidos do Mercado Livre
DELETE FROM public.mercado_livre_orders 
WHERE student_id = '0c82a4d1-a779-475d-9610-2b61c3098f33';

-- 7. Deletar métricas do Mercado Livre
DELETE FROM public.mercado_livre_metrics 
WHERE student_id = '0c82a4d1-a779-475d-9610-2b61c3098f33';

-- 8. Deletar contas do Mercado Livre
DELETE FROM public.mercado_livre_accounts 
WHERE student_id = '0c82a4d1-a779-475d-9610-2b61c3098f33';

-- 9. Deletar apps do aluno
DELETE FROM public.student_apps 
WHERE student_id = '0c82a4d1-a779-475d-9610-2b61c3098f33';

-- 10. Deletar entregas de bônus
DELETE FROM public.student_bonus_delivery 
WHERE student_id = '0c82a4d1-a779-475d-9610-2b61c3098f33';

-- 11. Deletar roles do usuário
DELETE FROM public.user_roles 
WHERE user_id = '0c82a4d1-a779-475d-9610-2b61c3098f33';

-- 12. Deletar perfil
DELETE FROM public.profiles 
WHERE id = '0c82a4d1-a779-475d-9610-2b61c3098f33';