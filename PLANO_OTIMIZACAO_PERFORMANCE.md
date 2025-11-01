# 📊 Plano de Otimização de Performance - Dashboard ML PRO

## 🔍 Análise dos Problemas Identificados

### 1. **Problema Crítico: `getMLAccountData` carrega TUDO sempre**

**Localização:** `src/services/api/mercadoLivre.ts:296-330`

**Problema:**
- Executa 7 queries pesadas em paralelo SEMPRE que a tela carrega
- `getMLProducts`: Busca TODOS os produtos sem limite (pode ser 1000+)
- `getMLFullStock`: Busca TODOS os produtos NOVAMENTE + estoque
- `getMLProductHealth`: Busca TODOS os health scores
- `getMLHealthHistory`: Busca 30 dias de histórico (pode ser 1000+ registros)
- `getMLCampaigns`: Busca TODAS as campanhas
- Executa mesmo quando usuário só quer ver aba "Geral"

**Impacto:** 7 queries pesadas = 3-10 segundos de loading

### 2. **Problema: Queries sem limite/paginação**

**Localizações:**
- `getMLProducts`: Linha 74-95 - `select('*')` sem limite
- `getMLFullStock`: Linha 157-185 - Busca todos produtos duas vezes
- `getMLProductHealth`: Linha 216-236 - `select('*')` sem limite
- `getMLHealthHistory`: Linha 241-273 - Sem limite, apenas filtro de data

**Impacto:** Pode trazer milhares de registros desnecessários

### 3. **Problema: Múltiplos refetches desnecessários**

**Localizações:**
- `StudentDashboard.tsx`: 5+ listeners realtime chamando `refetchAccounts()` 
- `MLAccountDashboard.tsx`: 5+ listeners chamando `refetchAccountData()` (que refaz todas as 7 queries)

**Impacto:** A cada mudança no banco, refaz todas as queries

### 4. **Problema: Falta de lazy loading por aba**

**Localização:** `MLAccountDashboard.tsx`

**Problema:**
- Carrega dados de todas as abas mesmo quando só precisa de "Geral"
- Dados de "Anúncios", "Estoque FULL", "Publicidade" são carregados sempre

**Impacto:** Carrega 4x mais dados do que necessário

### 5. **Problema: Queries duplicadas**

**Localizações:**
- `getMLFullStock`: Linha 158 - Busca TODOS os produtos, depois busca estoque e mescla
- Poderia usar JOIN ou buscar só produtos com estoque FULL

### 6. **Problema: Cache insuficiente**

**Localizações:**
- `useMLAccountData`: `staleTime: 5 minutos` - pode ser aumentado
- Não usa `placeholderData` para manter dados antigos durante refetch
- `refetchOnWindowFocus` pode estar habilitado em alguns hooks

---

## ✅ Plano de Correção

### Fase 1: Otimização Imediata (Crítico) 🔴

#### 1.1 Dividir `getMLAccountData` por aba
**Prioridade:** CRÍTICA
**Arquivo:** `src/services/api/mercadoLivre.ts`

**Ação:**
- Criar funções separadas:
  - `getMLAccountDataBasic()` - Só métricas + sellerRecovery (aba Geral)
  - `getMLAccountDataAnuncios()` - Métricas + produtos + health + history
  - `getMLAccountDataEstoque()` - Métricas + estoque FULL
  - `getMLAccountDataPublicidade()` - Métricas + campanhas + product ads

**Benefício:** Reduz de 7 queries para 2-3 queries por aba

#### 1.2 Adicionar limites e paginação
**Prioridade:** CRÍTICA
**Arquivo:** `src/services/api/mercadoLivre.ts`

**Ações:**
- `getMLProducts`: Adicionar `.limit(100)` inicial + paginação
- `getMLProductHealth`: Adicionar `.limit(500)` 
- `getMLHealthHistory`: Adicionar `.limit(100)` (últimos registros)
- `getMLFullStock`: Buscar só produtos FULL, não todos

**Benefício:** Reduz volume de dados em 70-90%

#### 1.3 Otimizar `getMLFullStock`
**Prioridade:** ALTA
**Arquivo:** `src/services/api/mercadoLivre.ts:157-185`

**Ação:**
- Buscar só produtos que têm estoque FULL
- Usar JOIN ou filtrar diretamente
- Não buscar todos produtos depois mesclar

**Benefício:** Reduz query de produtos duplicada

#### 1.4 Lazy loading por aba
**Prioridade:** CRÍTICA
**Arquivo:** `src/pages/MLAccountDashboard.tsx`

**Ação:**
- Carregar só dados básicos inicialmente
- Carregar dados específicos quando aba muda
- Usar hooks condicionais baseados em `activeTab`

**Benefício:** Reduz tempo inicial de 70-80%

### Fase 2: Otimização de Cache e Realtime 🟡

#### 2.1 Melhorar cache do React Query
**Prioridade:** ALTA
**Arquivos:** Hooks em `src/hooks/queries/`

**Ações:**
- Aumentar `staleTime` para 10-15 minutos (dados não mudam tão rápido)
- Adicionar `placeholderData` em todos os hooks
- Desabilitar `refetchOnWindowFocus` onde não necessário
- Usar `keepPreviousData: true` (React Query v5)

**Benefício:** Menos queries desnecessárias, melhor UX

#### 2.2 Debounce nos listeners Realtime
**Prioridade:** MÉDIA
**Arquivos:** `StudentDashboard.tsx`, `MLAccountDashboard.tsx`

**Ação:**
- Debounce de 500ms-1s antes de fazer refetch
- Evitar múltiplos refetches simultâneos

**Benefício:** Evita refetch em cascata

#### 2.3 Refetch seletivo
**Prioridade:** MÉDIA
**Arquivos:** `StudentDashboard.tsx`, `MLAccountDashboard.tsx`

**Ação:**
- Em vez de `refetchAccountData()` (refaz tudo), fazer refetch só dos dados que mudaram
- Exemplo: Se mudou métricas, só refetch métricas, não produtos

**Benefício:** Refetches mais rápidos

### Fase 3: Otimização de Queries 🟢

#### 3.1 Selecionar apenas campos necessários
**Prioridade:** MÉDIA
**Arquivos:** `src/services/api/mercadoLivre.ts`

**Ação:**
- Usar `select()` específico ao invés de `select('*')`
- Exemplo: `select('id, title, thumbnail, price, status')` ao invés de todos campos

**Benefício:** Reduz tamanho de resposta

#### 3.2 Índices no banco
**Prioridade:** MÉDIA
**Arquivo:** Migrações SQL

**Ações:**
- Verificar índices em `ml_account_id` (já existe?)
- Adicionar índice em `status` na tabela produtos
- Adicionar índice em `ml_item_id` em estoque FULL

**Benefício:** Queries mais rápidas no banco

#### 3.3 Query combinada para FULL Stock
**Prioridade:** BAIXA
**Arquivo:** `src/services/api/mercadoLivre.ts`

**Ação:**
- Criar view ou função SQL que retorna produtos + estoque em uma query
- Reduzir de 2 queries para 1

**Benefício:** Menos round-trips ao banco

---

## 📋 Checklist de Implementação

### Fase 1 - Crítico (Implementar Primeiro)
- [ ] 1.1 - Criar funções separadas por aba (`getMLAccountDataBasic`, etc)
- [ ] 1.2 - Adicionar limites em todas as queries (`limit()`)
- [ ] 1.3 - Otimizar `getMLFullStock` (não buscar todos produtos)
- [ ] 1.4 - Implementar lazy loading por aba no `MLAccountDashboard`
- [ ] Atualizar `useMLAccountData` para aceitar parâmetro de tipo de dados

### Fase 2 - Otimização de Cache
- [ ] 2.1 - Aumentar `staleTime` nos hooks (10-15 min)
- [ ] 2.2 - Adicionar `placeholderData` em hooks principais
- [ ] 2.3 - Desabilitar `refetchOnWindowFocus` onde não necessário
- [ ] 2.4 - Debounce nos listeners realtime (500ms-1s)
- [ ] 2.5 - Refetch seletivo (só dados que mudaram)

### Fase 3 - Otimizações Avançadas
- [ ] 3.1 - Selecionar campos específicos ao invés de `select('*')`
- [ ] 3.2 - Verificar/criar índices no banco
- [ ] 3.3 - Otimizar query de FULL Stock (combinação)

---

## 🎯 Resultados Esperados

### Antes (Atual):
- **Tempo de carregamento inicial:** 5-15 segundos
- **Queries executadas:** 7-10 queries pesadas
- **Dados transferidos:** 5-20 MB
- **Refetches:** A cada mudança realtime (múltiplos)

### Depois (Otimizado):
- **Tempo de carregamento inicial:** 1-3 segundos ⚡
- **Queries executadas:** 2-3 queries por aba
- **Dados transferidos:** 500KB-2MB 📉
- **Refetches:** Debounced + seletivo

### Melhorias Esperadas:
- ✅ 70-80% redução no tempo de carregamento
- ✅ 60-80% redução no volume de dados
- ✅ 50-70% menos queries no banco
- ✅ Melhor experiência do usuário (dados aparecem mais rápido)

---

## 🚀 Ordem de Implementação Recomendada

1. **Primeiro:** Fase 1.4 (Lazy loading por aba) - Maior impacto imediato
2. **Segundo:** Fase 1.1 (Dividir getMLAccountData) - Simplifica e permite lazy loading
3. **Terceiro:** Fase 1.2 (Limites nas queries) - Reduz dados transferidos
4. **Quarto:** Fase 1.3 (Otimizar FULL Stock) - Remove query duplicada
5. **Quinto:** Fase 2 (Cache e Realtime) - Melhora experiência contínua
6. **Sexto:** Fase 3 (Otimizações avançadas) - Incrementais

