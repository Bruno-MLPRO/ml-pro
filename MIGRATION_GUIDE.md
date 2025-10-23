# 🚀 Guia Completo de Migração - ML PRO para Supabase Próprio

## 📋 Índice
1. [Pré-requisitos](#pré-requisitos)
2. [Configuração Inicial](#configuração-inicial)
3. [Aplicação do Schema](#aplicação-do-schema)
4. [Configuração de Secrets](#configuração-de-secrets)
5. [Deploy de Edge Functions](#deploy-de-edge-functions)
6. [Configuração de Autenticação](#configuração-de-autenticação)
7. [Atualização do Frontend](#atualização-do-frontend)
8. [Configuração de Webhooks ML](#configuração-de-webhooks-ml)
9. [Migração de Dados (Opcional)](#migração-de-dados-opcional)
10. [Checklist de Validação](#checklist-de-validação)
11. [Troubleshooting](#troubleshooting)

---

## 🎯 Pré-requisitos

### Credenciais Necessárias
Você deve ter em mãos:
- ✅ **Project Reference ID**: `gkpbtkewurhzudrgfuog`
- ✅ **Project URL**: `https://gkpbtkewurhzudrgfuog.supabase.co`
- ✅ **Anon Key** (API Key pública)
- ✅ **Service Role Key** (API Key privada)
- ✅ **Database Password** (definida na criação do projeto)

### Ferramentas
- ✅ **Supabase CLI** instalado
  ```bash
  # Via npm
  npm install -g supabase
  
  # Ou via Homebrew (macOS)
  brew install supabase/tap/supabase
  ```

- ✅ **Git** instalado
- ✅ **Node.js** 18+ instalado

### Credenciais Mercado Livre
- ✅ **APP_ID** do Mercado Livre
- ✅ **SECRET_KEY** do Mercado Livre

---

## ⚙️ Configuração Inicial

### 1. Login no Supabase CLI

```bash
supabase login
```

Isso abrirá seu navegador para autenticação. Faça login com a mesma conta usada para criar o projeto.

### 2. Link do Projeto Local

No diretório raiz do seu projeto ML PRO:

```bash
supabase link --project-ref gkpbtkewurhzudrgfuog
```

Quando solicitado, insira a **Database Password** que você definiu na criação do projeto.

### 3. Verificar Conexão

```bash
supabase status
```

Você deve ver algo como:
```
API URL: https://gkpbtkewurhzudrgfuog.supabase.co
DB URL: postgresql://postgres:[PASSWORD]@db.gkpbtkewurhzudrgfuog.supabase.co:5432/postgres
Studio URL: https://supabase.com/dashboard/project/gkpbtkewurhzudrgfuog
```

---

## 🗄️ Aplicação do Schema

### 1. Aplicar a Migration SQL

O arquivo `supabase/migrations/20250101000000_initial_schema.sql` contém o schema completo.

```bash
supabase db push
```

Este comando irá:
- ✅ Criar todos os ENUMs (app_role, milestone_status)
- ✅ Criar 35+ tabelas com constraints
- ✅ Criar 1 View (mercado_livre_accounts_safe)
- ✅ Criar 12 Functions
- ✅ Criar 20+ Triggers
- ✅ Aplicar 80+ RLS Policies
- ✅ Criar índices de performance

### 2. Verificar Aplicação

```bash
# Ver tabelas criadas
supabase db remote list

# Ver funções criadas
supabase db remote list --type function
```

**Esperado**: Você deve ver todas as 35+ tabelas listadas.

---

## 🔐 Configuração de Secrets

### Via Supabase CLI

```bash
# Mercado Livre Credentials
supabase secrets set MERCADO_LIVRE_APP_ID="SEU_APP_ID_AQUI" --project-ref gkpbtkewurhzudrgfuog
supabase secrets set MERCADO_LIVRE_SECRET_KEY="SUA_SECRET_KEY_AQUI" --project-ref gkpbtkewurhzudrgfuog

# Application URL
supabase secrets set APP_URL="https://ml-pro-kappa.vercel.app" --project-ref gkpbtkewurhzudrgfuog

# Supabase URLs (já configurados automaticamente, mas verificar)
supabase secrets set SUPABASE_URL="https://gkpbtkewurhzudrgfuog.supabase.co" --project-ref gkpbtkewurhzudrgfuog
supabase secrets set SUPABASE_ANON_KEY="SUA_ANON_KEY_AQUI" --project-ref gkpbtkewurhzudrgfuog
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE_KEY_AQUI" --project-ref gkpbtkewurhzudrgfuog
supabase secrets set SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.gkpbtkewurhzudrgfuog.supabase.co:5432/postgres" --project-ref gkpbtkewurhzudrgfuog
```

### Verificar Secrets Configurados

```bash
supabase secrets list --project-ref gkpbtkewurhzudrgfuog
```

**Esperado**: Você deve ver 7 secrets listados (valores ocultos por segurança).

---

## ⚡ Deploy de Edge Functions

### 1. Verificar Configuração

Certifique-se de que `supabase/config.toml` tem todas as 22 funções listadas:

```toml
project_id = "gkpbtkewurhzudrgfuog"

[functions.ml-oauth-callback]
verify_jwt = false

[functions.ml-webhook-receiver]
verify_jwt = false

[functions.ml-test-connection]
verify_jwt = false

[functions.ml-sync-status]
verify_jwt = false

[functions.ml-auto-sync-all]
verify_jwt = false

[functions.ml-fix-advertiser-ids]
verify_jwt = false

[functions.calculate-monthly-metrics]
verify_jwt = false

[functions.calculate-student-monthly-metrics]
verify_jwt = false

[functions.ml-auth-start]
verify_jwt = true

[functions.ml-sync-data]
verify_jwt = true

[functions.ml-get-accounts]
verify_jwt = true

[functions.ml-get-products]
verify_jwt = true

[functions.ml-disconnect-account]
verify_jwt = true

[functions.ml-check-product-ads-status]
verify_jwt = true

[functions.ml-get-product-ads-data]
verify_jwt = true

[functions.ml-debug-product-ads-response]
verify_jwt = true

[functions.ml-get-seller-recovery-status]
verify_jwt = true

[functions.ml-fix-product-photos]
verify_jwt = true

[functions.ml-fix-tax-data]
verify_jwt = true

[functions.ml-get-item-health]
verify_jwt = true

[functions.create-student]
verify_jwt = true

[functions.delete-user-auth]
verify_jwt = true
```

### 2. Deploy de Todas as Funções

```bash
supabase functions deploy --project-ref gkpbtkewurhzudrgfuog
```

Este comando irá fazer o deploy de **todas as 22 Edge Functions** de uma vez.

### 3. Verificar Deploy

```bash
supabase functions list --project-ref gkpbtkewurhzudrgfuog
```

**Esperado**: Você deve ver todas as 22 funções listadas com status "deployed".

### 4. Testar uma Função (Exemplo)

```bash
curl -X POST \
  https://gkpbtkewurhzudrgfuog.supabase.co/functions/v1/ml-test-connection \
  -H "Content-Type: application/json"
```

**Esperado**: Resposta JSON com informações de configuração.

---

## 🔧 Configuração de Autenticação

### 1. No Supabase Dashboard

Acesse: https://supabase.com/dashboard/project/gkpbtkewurhzudrgfuog/auth/url-configuration

#### Site URL
```
https://ml-pro-kappa.vercel.app
```

#### Redirect URLs (adicionar ambas)
```
https://ml-pro-kappa.vercel.app/auth/callback
http://localhost:8080/auth/callback
```

### 2. Configurar Auto-Confirm Email

Acesse: https://supabase.com/dashboard/project/gkpbtkewurhzudrgfuog/auth/providers

Em **Email Provider**:
- ✅ Desabilitar "Confirm email"
- ✅ Salvar alterações

Isso permite que usuários façam login imediatamente após o signup (útil para desenvolvimento/testes).

### 3. Verificar Configuração

No dashboard, em **Authentication > Settings**, confirme:
- ✅ Site URL está correto
- ✅ Redirect URLs estão adicionadas
- ✅ Email auto-confirm está desabilitado

---

## 🌐 Atualização do Frontend

### 1. Atualizar Environment Variables no Vercel

Acesse: https://vercel.com/seu-usuario/ml-pro/settings/environment-variables

Atualize as seguintes variáveis:

```
VITE_SUPABASE_URL=https://gkpbtkewurhzudrgfuog.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[SUA_ANON_KEY]
VITE_SUPABASE_PROJECT_ID=gkpbtkewurhzudrgfuog
```

### 2. Re-deploy no Vercel

Após atualizar as env vars, force um novo deploy:

```bash
# Via CLI (se você tem Vercel CLI instalado)
vercel --prod

# Ou via Dashboard:
# Vercel Dashboard > Deployments > Redeploy
```

### 3. Verificar Conexão

Após o deploy, acesse:
```
https://ml-pro-kappa.vercel.app
```

Abra o **Console do navegador** (F12) e procure por logs de conexão com Supabase. Não deve haver erros de autenticação.

---

## 🔗 Configuração de Webhooks ML

### 1. Atualizar Redirect URI no Mercado Livre Developers

Acesse: https://developers.mercadolivre.com.br/apps

Selecione seu APP e atualize:

#### Redirect URI
```
https://gkpbtkewurhzudrgfuog.supabase.co/functions/v1/ml-oauth-callback
```

### 2. Verificar Webhook Receiver

O webhook receiver já está configurado para receber notificações em:
```
https://gkpbtkewurhzudrgfuog.supabase.co/functions/v1/ml-webhook-receiver
```

**Nota**: Os webhooks são configurados automaticamente pela edge function `ml-oauth-callback` quando um usuário conecta sua conta ML.

---

## 🔄 Migração de Dados (Opcional)

⚠️ **Importante**: Esta seção é **opcional** e só necessária se você quiser trazer dados existentes do projeto Lovable Cloud para o novo Supabase.

### Se Você NÃO Precisa Migrar Dados
- ✅ Pule esta seção
- ✅ Usuários começarão do zero no novo ambiente
- ✅ Vá direto para [Checklist de Validação](#checklist-de-validação)

### Se Você QUER Migrar Dados

#### 1. Exportar Dados do Lovable Cloud

```bash
# Conectar ao projeto antigo temporariamente
supabase link --project-ref yxlxholcipprdozohwhn

# Dump do banco de dados
supabase db dump -f backup_lovable_cloud.sql --project-ref yxlxholcipprdozohwhn

# Ou exportar apenas dados (sem schema)
supabase db dump -f backup_data_only.sql --data-only --project-ref yxlxholcipprdozohwhn
```

#### 2. Revisar e Ajustar o Dump

⚠️ **CRÍTICO**: Remova do dump:
- ❌ Comandos `CREATE TABLE` (já aplicados pela migration)
- ❌ Comandos `CREATE FUNCTION` (já aplicados)
- ❌ Comandos `CREATE TRIGGER` (já aplicados)
- ❌ Dados de tabelas `auth.*` (gerenciadas pelo Supabase)
- ✅ Mantenha apenas comandos `INSERT INTO` para suas tabelas

#### 3. Importar Dados

```bash
# Reconectar ao novo projeto
supabase link --project-ref gkpbtkewurhzudrgfuog

# Importar dados
psql -h db.gkpbtkewurhzudrgfuog.supabase.co -U postgres -d postgres -f backup_data_only.sql
```

#### 4. Verificar Importação

```bash
# Ver número de registros em cada tabela
supabase db remote execute "
  SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
" --project-ref gkpbtkewurhzudrgfuog
```

---

## ✅ Checklist de Validação

Use este checklist para garantir que tudo está funcionando:

### 🗄️ Database
- [ ] **Schema aplicado**: 35+ tabelas criadas
  ```bash
  supabase db remote list --project-ref gkpbtkewurhzudrgfuog
  ```
- [ ] **Functions criadas**: 12 functions no banco
  ```bash
  supabase db remote list --type function --project-ref gkpbtkewurhzudrgfuog
  ```
- [ ] **Triggers ativos**: 20+ triggers funcionando
- [ ] **RLS policies**: 80+ políticas aplicadas
- [ ] **Índices criados**: Performance otimizada

### ⚡ Edge Functions
- [ ] **22 funções deployed**
  ```bash
  supabase functions list --project-ref gkpbtkewurhzudrgfuog
  ```
- [ ] **Logs sem erros**: Verificar logs das funções
  ```bash
  supabase functions logs ml-test-connection --project-ref gkpbtkewurhzudrgfuog
  ```

### 🔐 Secrets
- [ ] **7 secrets configurados**
  ```bash
  supabase secrets list --project-ref gkpbtkewurhzudrgfuog
  ```

### 🔧 Autenticação
- [ ] **Site URL configurado**: `https://ml-pro-kappa.vercel.app`
- [ ] **Redirect URLs adicionadas**
- [ ] **Auto-confirm email desabilitado**

### 🌐 Frontend
- [ ] **Env vars atualizadas no Vercel**
- [ ] **Deploy efetuado com sucesso**
- [ ] **App carrega sem erros**

### 🔗 Mercado Livre
- [ ] **OAuth Redirect URI atualizado**
- [ ] **Webhook receiver configurado**

### 🧪 Testes Funcionais
- [ ] **Login funciona**: Criar usuário teste
  - Acessar `/auth`
  - Fazer signup com email/senha
  - Confirmar login automático
  
- [ ] **OAuth ML funciona**: Conectar conta ML
  - Ir para dashboard do aluno
  - Clicar em "Conectar Mercado Livre"
  - Confirmar redirecionamento para ML
  - Confirmar callback de sucesso
  
- [ ] **Dashboards carregam**: Métricas aparecem
  - Dashboard do aluno deve carregar
  - Dashboard do gestor deve carregar (se aplicável)
  
- [ ] **Sync funciona**: `ml-sync-data` executando
  - Verificar logs da função
  - Confirmar que dados estão sendo sincronizados
  
- [ ] **Webhooks funcionam**: Testar recebimento
  - Fazer uma venda de teste no ML
  - Verificar se webhook foi recebido
  - Verificar logs de `ml-webhook-receiver`

### 🔒 Segurança RLS
- [ ] **Usuários veem apenas seus dados**
  - Criar 2 usuários teste
  - Verificar que User A não vê dados de User B
  - Verificar que gestores veem todos os dados

---

## 🆘 Troubleshooting

### Problema: "Failed to link project"

**Solução**:
```bash
# Desconectar projeto anterior (se houver)
supabase unlink

# Tentar novamente
supabase link --project-ref gkpbtkewurhzudrgfuog
```

### Problema: "Database password incorrect"

**Solução**:
1. Reset password no dashboard: https://supabase.com/dashboard/project/gkpbtkewurhzudrgfuog/settings/database
2. Anotar nova senha
3. Executar `supabase link` novamente

### Problema: "Migration failed"

**Solução**:
```bash
# Ver detalhes do erro
supabase db push --debug

# Se necessário, limpar banco e reaplicar
supabase db reset --project-ref gkpbtkewurhzudrgfuog
supabase db push
```

### Problema: "Edge function deploy failed"

**Solução**:
```bash
# Deploy função por função para identificar problema
supabase functions deploy ml-oauth-callback --project-ref gkpbtkewurhzudrgfuog
supabase functions deploy ml-webhook-receiver --project-ref gkpbtkewurhzudrgfuog
# ... etc

# Ver logs de deploy
supabase functions logs ml-oauth-callback --project-ref gkpbtkewurhzudrgfuog
```

### Problema: "Secrets not found in edge functions"

**Solução**:
```bash
# Verificar se secrets foram setados
supabase secrets list --project-ref gkpbtkewurhzudrgfuog

# Re-setar secrets
supabase secrets set MERCADO_LIVRE_APP_ID="..." --project-ref gkpbtkewurhzudrgfuog
supabase secrets set MERCADO_LIVRE_SECRET_KEY="..." --project-ref gkpbtkewurhzudrgfuog
```

### Problema: "RLS policies blocking queries"

**Solução**:
```bash
# Temporariamente desabilitar RLS para debug (NÃO EM PRODUÇÃO)
supabase db remote execute "ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;" --project-ref gkpbtkewurhzudrgfuog

# Ver políticas aplicadas
supabase db remote execute "SELECT * FROM pg_policies WHERE tablename = 'profiles';" --project-ref gkpbtkewurhzudrgfuog

# Reabilitar RLS
supabase db remote execute "ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;" --project-ref gkpbtkewurhzudrgfuog
```

### Problema: "CORS errors in frontend"

**Solução**:
1. Verificar se `corsHeaders` estão corretos nas edge functions
2. Verificar se Site URL está configurado no Supabase Dashboard
3. Verificar se Redirect URLs incluem o domínio do frontend

### Problema: "Cannot read property 'user' of null"

**Solução**:
1. Verificar se `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` estão corretos no Vercel
2. Limpar cache do navegador
3. Re-deploy no Vercel

### Problema: "ML OAuth callback not working"

**Solução**:
1. Verificar se Redirect URI no ML Developers está correto:
   ```
   https://gkpbtkewurhzudrgfuog.supabase.co/functions/v1/ml-oauth-callback
   ```
2. Verificar logs da função:
   ```bash
   supabase functions logs ml-oauth-callback --project-ref gkpbtkewurhzudrgfuog
   ```
3. Testar função diretamente:
   ```bash
   curl "https://gkpbtkewurhzudrgfuog.supabase.co/functions/v1/ml-oauth-callback?code=TEST"
   ```

---

## 📚 Recursos Adicionais

### Documentação Oficial
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Mercado Livre API](https://developers.mercadolivre.com.br/)

### Comandos Úteis

```bash
# Ver status geral
supabase status

# Ver logs de todas as funções
supabase functions logs --project-ref gkpbtkewurhzudrgfuog

# Executar query no banco
supabase db remote execute "SELECT COUNT(*) FROM profiles;" --project-ref gkpbtkewurhzudrgfuog

# Ver configurações do projeto
supabase projects list
```

---

## ✅ Finalização

Após completar todos os passos e validações:

1. ✅ Teste o sistema completamente em produção
2. ✅ Monitore logs por 24-48 horas
3. ✅ Só depois desative o projeto Lovable Cloud antigo (se desejar)
4. ✅ Mantenha backup do dump de dados

**Parabéns! 🎉 Sua migração está completa!**

---

## 📞 Suporte

Se encontrar problemas não cobertos neste guia:
1. Verifique logs detalhados: `supabase functions logs --project-ref gkpbtkewurhzudrgfuog`
2. Revise configurações no dashboard: https://supabase.com/dashboard/project/gkpbtkewurhzudrgfuog
3. Consulte documentação oficial do Supabase
