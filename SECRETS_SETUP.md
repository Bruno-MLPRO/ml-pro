# 🔐 Guia de Configuração de Secrets - ML PRO

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Lista de Secrets Necessários](#lista-de-secrets-necessários)
3. [Configuração via CLI](#configuração-via-cli)
4. [Configuração via Dashboard](#configuração-via-dashboard)
5. [Verificação](#verificação)
6. [Segurança](#segurança)

---

## 🎯 Visão Geral

O ML PRO requer 7 secrets configurados no Supabase para que as Edge Functions funcionem corretamente. Secrets são variáveis de ambiente seguras que não são expostas no código-fonte.

### Por que usar Secrets?
- ✅ **Segurança**: Credenciais não ficam no código
- ✅ **Flexibilidade**: Mudar valores sem alterar código
- ✅ **Multi-ambiente**: Valores diferentes para dev/prod
- ✅ **Compliance**: Atende boas práticas de segurança

---

## 📝 Lista de Secrets Necessários

### 1. MERCADO_LIVRE_APP_ID
- **Descrição**: ID da aplicação no Mercado Livre
- **Onde obter**: https://developers.mercadolivre.com.br/apps
- **Formato**: Número inteiro (ex: `1234567890123456`)
- **Usado por**: Todas as edge functions de OAuth e sync ML

### 2. MERCADO_LIVRE_SECRET_KEY
- **Descrição**: Secret key da aplicação no Mercado Livre
- **Onde obter**: https://developers.mercadolivre.com.br/apps
- **Formato**: String alfanumérica (ex: `AbCdEfGhIjKlMnOpQrStUvWxYz123456`)
- **Usado por**: Todas as edge functions de OAuth e sync ML
- ⚠️ **CRÍTICO**: Nunca exponha esta chave publicamente

### 3. APP_URL
- **Descrição**: URL da aplicação em produção
- **Valor**: `https://ml-pro-kappa.vercel.app`
- **Formato**: URL completa com protocolo
- **Usado por**: Edge functions para construir redirect URLs

### 4. SUPABASE_URL
- **Descrição**: URL do projeto Supabase
- **Valor**: `https://gkpbtkewurhzudrgfuog.supabase.co`
- **Formato**: URL completa com protocolo
- **Usado por**: Edge functions para conexão com DB
- ℹ️ **Nota**: Geralmente auto-configurado, mas verificar

### 5. SUPABASE_ANON_KEY
- **Descrição**: Chave pública/anon do Supabase
- **Onde obter**: Dashboard > Project Settings > API
- **Formato**: JWT token (string longa)
- **Usado por**: Edge functions para queries autenticadas
- ℹ️ **Nota**: É "pública" mas ainda deve ser secret nas functions

### 6. SUPABASE_SERVICE_ROLE_KEY
- **Descrição**: Chave de serviço com acesso total ao DB
- **Onde obter**: Dashboard > Project Settings > API
- **Formato**: JWT token (string longa)
- **Usado por**: Edge functions que precisam bypass RLS
- ⚠️ **CRÍTICO**: Nunca exponha esta chave no frontend

### 7. SUPABASE_DB_URL
- **Descrição**: Connection string do banco PostgreSQL
- **Onde obter**: Dashboard > Project Settings > Database
- **Formato**: `postgresql://postgres:[PASSWORD]@db.gkpbtkewurhzudrgfuog.supabase.co:5432/postgres`
- **Usado por**: Edge functions que fazem conexão direta ao DB
- ⚠️ **CRÍTICO**: Contém senha do banco, nunca exponha

---

## ⚙️ Configuração via CLI

### Pré-requisito
```bash
# Instalar Supabase CLI (se ainda não tiver)
npm install -g supabase

# Fazer login
supabase login
```

### Configurar Todos os Secrets

```bash
# 1. Mercado Livre Credentials
supabase secrets set MERCADO_LIVRE_APP_ID="SEU_APP_ID_AQUI" \
  --project-ref gkpbtkewurhzudrgfuog

supabase secrets set MERCADO_LIVRE_SECRET_KEY="SUA_SECRET_KEY_AQUI" \
  --project-ref gkpbtkewurhzudrgfuog

# 2. Application URL
supabase secrets set APP_URL="https://ml-pro-kappa.vercel.app" \
  --project-ref gkpbtkewurhzudrgfuog

# 3. Supabase Configuration
supabase secrets set SUPABASE_URL="https://gkpbtkewurhzudrgfuog.supabase.co" \
  --project-ref gkpbtkewurhzudrgfuog

supabase secrets set SUPABASE_ANON_KEY="SUA_ANON_KEY_AQUI" \
  --project-ref gkpbtkewurhzudrgfuog

supabase secrets set SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE_KEY_AQUI" \
  --project-ref gkpbtkewurhzudrgfuog

supabase secrets set SUPABASE_DB_URL="postgresql://postgres:SUA_SENHA@db.gkpbtkewurhzudrgfuog.supabase.co:5432/postgres" \
  --project-ref gkpbtkewurhzudrgfuog
```

### Script de Configuração Rápida

Crie um arquivo `setup-secrets.sh`:

```bash
#!/bin/bash

# ML PRO - Secrets Setup Script
# Replace values below with your actual credentials

PROJECT_REF="gkpbtkewurhzudrgfuog"

echo "🔐 Setting up ML PRO Secrets..."

# Mercado Livre
echo "Setting MERCADO_LIVRE_APP_ID..."
supabase secrets set MERCADO_LIVRE_APP_ID="YOUR_ML_APP_ID" --project-ref $PROJECT_REF

echo "Setting MERCADO_LIVRE_SECRET_KEY..."
supabase secrets set MERCADO_LIVRE_SECRET_KEY="YOUR_ML_SECRET_KEY" --project-ref $PROJECT_REF

# Application
echo "Setting APP_URL..."
supabase secrets set APP_URL="https://ml-pro-kappa.vercel.app" --project-ref $PROJECT_REF

# Supabase
echo "Setting SUPABASE_URL..."
supabase secrets set SUPABASE_URL="https://gkpbtkewurhzudrgfuog.supabase.co" --project-ref $PROJECT_REF

echo "Setting SUPABASE_ANON_KEY..."
supabase secrets set SUPABASE_ANON_KEY="YOUR_ANON_KEY" --project-ref $PROJECT_REF

echo "Setting SUPABASE_SERVICE_ROLE_KEY..."
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" --project-ref $PROJECT_REF

echo "Setting SUPABASE_DB_URL..."
supabase secrets set SUPABASE_DB_URL="postgresql://postgres:YOUR_PASSWORD@db.gkpbtkewurhzudrgfuog.supabase.co:5432/postgres" --project-ref $PROJECT_REF

echo "✅ All secrets configured!"
```

Executar:
```bash
chmod +x setup-secrets.sh
./setup-secrets.sh
```

---

## 🖥️ Configuração via Dashboard

### Passo 1: Acessar Dashboard
https://supabase.com/dashboard/project/gkpbtkewurhzudrgfuog/settings/vault/secrets

### Passo 2: Adicionar Cada Secret

1. Clicar em "Add secret"
2. Preencher:
   - **Name**: Nome exato do secret (ex: `MERCADO_LIVRE_APP_ID`)
   - **Value**: Valor do secret
3. Clicar em "Create secret"
4. Repetir para todos os 7 secrets

### Onde Encontrar os Valores

#### Mercado Livre (APP_ID e SECRET_KEY)
1. Acesse: https://developers.mercadolivre.com.br/apps
2. Faça login com sua conta ML
3. Selecione seu aplicativo
4. Copie:
   - **App ID**: Número longo na página de detalhes
   - **Secret Key**: Clique em "Mostrar" ao lado de "Secret key"

#### Supabase Keys
1. Acesse: https://supabase.com/dashboard/project/gkpbtkewurhzudrgfuog/settings/api
2. Copie:
   - **URL**: Project URL
   - **anon key**: Anon public key
   - **service_role key**: Service role key (clicar em "Reveal")

#### Database URL
1. Acesse: https://supabase.com/dashboard/project/gkpbtkewurhzudrgfuog/settings/database
2. Copie a **Connection string**
3. Substitua `[YOUR-PASSWORD]` pela senha do banco

---

## ✅ Verificação

### Via CLI

```bash
# Listar todos os secrets (valores ficam ocultos)
supabase secrets list --project-ref gkpbtkewurhzudrgfuog
```

Saída esperada:
```
NAME                          VALUE
MERCADO_LIVRE_APP_ID          ***********
MERCADO_LIVRE_SECRET_KEY      ***********
APP_URL                       ***********
SUPABASE_URL                  ***********
SUPABASE_ANON_KEY            ***********
SUPABASE_SERVICE_ROLE_KEY    ***********
SUPABASE_DB_URL              ***********
```

### Via Dashboard

1. Acesse: https://supabase.com/dashboard/project/gkpbtkewurhzudrgfuog/settings/vault/secrets
2. Verifique se todos os 7 secrets estão listados
3. Valores estarão ocultos por segurança

### Testar Edge Function

```bash
# Testar ml-test-connection (deve retornar configurações)
curl -X POST \
  https://gkpbtkewurhzudrgfuog.supabase.co/functions/v1/ml-test-connection \
  -H "Content-Type: application/json"
```

Resposta esperada (se secrets configurados):
```json
{
  "app_id_configured": true,
  "secret_key_configured": true,
  "callback_url": "https://gkpbtkewurhzudrgfuog.supabase.co/functions/v1/ml-oauth-callback",
  "app_id_preview": "12345678..."
}
```

---

## 🔒 Segurança

### Melhores Práticas

#### ✅ FAZER:
- ✅ Usar secrets para TODAS as credenciais sensíveis
- ✅ Rotacionar keys periodicamente (a cada 3-6 meses)
- ✅ Usar valores diferentes para dev/staging/prod
- ✅ Limitar acesso ao dashboard do Supabase
- ✅ Monitorar logs para acessos suspeitos
- ✅ Usar 2FA na conta do Mercado Livre
- ✅ Documentar alterações de secrets

#### ❌ NÃO FAZER:
- ❌ Nunca commitar secrets no git
- ❌ Nunca expor SERVICE_ROLE_KEY no frontend
- ❌ Nunca compartilhar secrets por email/slack
- ❌ Nunca logar valores de secrets no console
- ❌ Nunca usar mesmas keys em múltiplos projetos
- ❌ Nunca hardcodar secrets no código

### Rotação de Secrets

#### Quando rotacionar?
- 🔄 A cada 3-6 meses (rotação programada)
- 🔄 Quando um desenvolvedor sair da equipe
- 🔄 Se houver suspeita de vazamento
- 🔄 Após incidente de segurança

#### Como rotacionar?

1. **Mercado Livre Keys**:
   ```bash
   # Gerar novas keys no ML Developers
   # Atualizar secrets
   supabase secrets set MERCADO_LIVRE_APP_ID="NEW_VALUE" --project-ref gkpbtkewurhzudrgfuog
   supabase secrets set MERCADO_LIVRE_SECRET_KEY="NEW_VALUE" --project-ref gkpbtkewurhzudrgfuog
   ```

2. **Supabase Keys**:
   - Service Role Key não pode ser rotacionada facilmente
   - Se necessário, criar novo projeto Supabase
   - Anon Key pode ser rotacionada via dashboard

3. **Database Password**:
   ```bash
   # Via dashboard: Settings > Database > Reset password
   # Atualizar SUPABASE_DB_URL com nova senha
   supabase secrets set SUPABASE_DB_URL="postgresql://..." --project-ref gkpbtkewurhzudrgfuog
   ```

### Monitoramento

#### Logs de Acesso
```bash
# Ver logs de edge functions para detectar acessos anormais
supabase functions logs --project-ref gkpbtkewurhzudrgfuog
```

#### Alertas
- Configure alertas no Supabase Dashboard para:
  - Falhas de autenticação múltiplas
  - Acessos de IPs suspeitos
  - Uso anormal de recursos

---

## 🆘 Troubleshooting

### Problema: "Secret not found"

**Causa**: Secret não foi configurado ou nome está errado

**Solução**:
```bash
# Verificar lista de secrets
supabase secrets list --project-ref gkpbtkewurhzudrgfuog

# Setar secret com nome exato
supabase secrets set NOME_EXATO="valor" --project-ref gkpbtkewurhzudrgfuog
```

### Problema: "Invalid Mercado Livre credentials"

**Causa**: APP_ID ou SECRET_KEY incorretos

**Solução**:
1. Verificar no ML Developers: https://developers.mercadolivre.com.br/apps
2. Copiar valores exatos (sem espaços)
3. Re-setar secrets:
   ```bash
   supabase secrets set MERCADO_LIVRE_APP_ID="valor_correto" --project-ref gkpbtkewurhzudrgfuog
   supabase secrets set MERCADO_LIVRE_SECRET_KEY="valor_correto" --project-ref gkpbtkewurhzudrgfuog
   ```

### Problema: "Database connection failed"

**Causa**: SUPABASE_DB_URL incorreto ou senha errada

**Solução**:
1. Verificar connection string no dashboard
2. Resetar senha se necessário
3. Atualizar secret:
   ```bash
   supabase secrets set SUPABASE_DB_URL="postgresql://postgres:NOVA_SENHA@db.gkpbtkewurhzudrgfuog.supabase.co:5432/postgres" --project-ref gkpbtkewurhzudrgfuog
   ```

### Problema: "Secrets não aplicados após deploy"

**Causa**: Edge functions não foram re-deployed após setar secrets

**Solução**:
```bash
# Re-deploy todas as funções
supabase functions deploy --project-ref gkpbtkewurhzudrgfuog
```

---

## 📚 Recursos Adicionais

### Documentação
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)
- [Mercado Livre OAuth](https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao)
- [Best Practices for API Keys](https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password)

### Comandos Úteis

```bash
# Listar secrets
supabase secrets list --project-ref gkpbtkewurhzudrgfuog

# Setar secret
supabase secrets set KEY="value" --project-ref gkpbtkewurhzudrgfuog

# Remover secret
supabase secrets unset KEY --project-ref gkpbtkewurhzudrgfuog

# Ver logs de funções
supabase functions logs --project-ref gkpbtkewurhzudrgfuog
```

---

## ✅ Checklist Final

Antes de considerar a configuração completa:

- [ ] 7 secrets configurados
- [ ] Secrets verificados via `supabase secrets list`
- [ ] `ml-test-connection` retorna sucesso
- [ ] Edge functions fazem deploy sem erros
- [ ] OAuth ML funciona (teste de conexão)
- [ ] Webhooks ML funcionam (teste de recebimento)
- [ ] Logs não mostram erros de secrets
- [ ] Documentação de secrets atualizada
- [ ] Backup de credenciais em local seguro
- [ ] Plano de rotação definido

---

**⚠️ LEMBRE-SE**: Secrets são a primeira linha de defesa da sua aplicação. Trate-os com o máximo cuidado!
