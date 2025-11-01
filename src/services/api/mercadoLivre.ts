// Serviço de API para Mercado Livre

import { supabase } from '@/integrations/supabase/client';
import type { 
  MLAccount, 
  MLMetrics, 
  MLProduct, 
  MLOrder, 
  MLFullStock, 
  MLCampaign,
  ProductHealth,
  HealthHistory,
  MLSellerRecovery
} from '@/types/mercadoLivre';
import type { PaginatedOrdersResult } from '@/types/metrics';

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

/**
 * Busca todas as contas ML de um estudante
 */
export async function getMLAccounts(studentId: string): Promise<MLAccount[]> {
  const { data, error } = await supabase.functions.invoke('ml-get-accounts');
  
  if (error) {
    throw new Error(`Erro ao buscar contas ML: ${error.message}`);
  }
  
  // A Edge Function retorna ml_nickname, garantir que está presente
  if (!data?.accounts || data.accounts.length === 0) {
    return [];
  }

  return data.accounts.map((acc: any) => {
    // Garantir que ml_nickname não seja vazio - se estiver, usar fallback
    const mlNickname = acc.ml_nickname || acc.nickname || 'Conta sem nome';
    
    return {
      id: acc.id,
      ml_nickname: mlNickname,
      ml_user_id: acc.ml_user_id || parseInt(acc.ml_user_id?.toString() || '0', 10),
      is_primary: acc.is_primary || false,
      is_active: acc.is_active ?? true,
      connected_at: acc.connected_at || acc.created_at || new Date().toISOString(),
      last_sync_at: acc.last_sync_at || null,
      metrics: acc.metrics || null
    };
  });
}

/**
 * Busca métricas de uma conta ML
 */
export async function getMLMetrics(accountId: string): Promise<MLMetrics | null> {
  const { data, error } = await supabase
    .from('mercado_livre_metrics')
    .select('*')
    .eq('ml_account_id', accountId)
    .order('last_updated', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  return data;
}

/**
 * Busca produtos de uma conta ML
 */
export async function getMLProducts(
  accountId: string, 
  studentId?: string
): Promise<MLProduct[]> {
  let query = supabase
    .from('mercado_livre_products')
    .select('*')
    .eq('ml_account_id', accountId)
    .order('title');
  
  if (studentId) {
    query = query.eq('student_id', studentId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw error;
  }
  
  return data || [];
}

/**
 * Busca pedidos de um estudante com paginação
 */
export async function getMLOrders(
  studentId: string,
  periodDays: number = 30,
  status: string = 'paid'
): Promise<PaginatedOrdersResult> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);
  
  let allOrders: any[] = [];
  let currentPage = 0;
  let hasMore = true;
  let totalCount = 0;
  
  while (hasMore && currentPage < MAX_PAGES) {
    const rangeStart = currentPage * PAGE_SIZE;
    const rangeEnd = rangeStart + PAGE_SIZE - 1;
    
    const { data: pageOrders, error, count } = await supabase
      .from('mercado_livre_orders')
      .select('total_amount, paid_amount, date_created, ml_order_id', { count: 'exact' })
      .eq('student_id', studentId)
      .eq('status', status)
      .gte('date_created', periodStart.toISOString())
      .order('date_created', { ascending: false })
      .range(rangeStart, rangeEnd);
    
    if (error) {
      throw error;
    }
    
    if (currentPage === 0) {
      totalCount = count || 0;
    }
    
    if (pageOrders && pageOrders.length > 0) {
      allOrders = [...allOrders, ...pageOrders];
      currentPage++;
      
      if (pageOrders.length < PAGE_SIZE) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }
  
  return {
    orders: allOrders,
    totalCount,
    hasMore: currentPage >= MAX_PAGES,
    limitReached: currentPage >= MAX_PAGES
  };
}

/**
 * Busca dados diários dos últimos 30 dias para uma conta ML
 */
export async function getMLDailyMetrics(
  accountId: string,
  studentId?: string,
  periodDays: number = 30
): Promise<Array<{ date: string; sales: number; revenue: number; ticket: number }>> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);
  
  let allOrders: any[] = [];
  let currentPage = 0;
  let hasMore = true;
  
  while (hasMore && currentPage < MAX_PAGES) {
    const rangeStart = currentPage * PAGE_SIZE;
    const rangeEnd = rangeStart + PAGE_SIZE - 1;
    
    let query = supabase
      .from('mercado_livre_orders')
      .select('total_amount, paid_amount, date_created, ml_order_id')
      .eq('ml_account_id', accountId)
      .eq('status', 'paid')
      .gte('date_created', periodStart.toISOString())
      .order('date_created', { ascending: true })
      .range(rangeStart, rangeEnd);
    
    const { data: pageOrders, error } = await query;
    
    if (error) {
      throw error;
    }
    
    if (pageOrders && pageOrders.length > 0) {
      allOrders = [...allOrders, ...pageOrders];
      currentPage++;
      
      if (pageOrders.length < PAGE_SIZE) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  // Agrupar por dia
  const dailyData = new Map<string, { sales: number; revenue: number }>();
  
  allOrders.forEach(order => {
    const date = new Date(order.date_created).toISOString().split('T')[0];
    const paidAmount = Number(order.paid_amount) || 0;
    
    if (!dailyData.has(date)) {
      dailyData.set(date, { sales: 0, revenue: 0 });
    }
    
    const dayData = dailyData.get(date)!;
    dayData.sales += 1;
    dayData.revenue += paidAmount;
  });

  // Preencher todos os dias dos últimos 30 dias (mesmo sem dados)
  const result: Array<{ date: string; sales: number; revenue: number; ticket: number }> = [];
  
  for (let i = periodDays - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayData = dailyData.get(dateStr) || { sales: 0, revenue: 0 };
    const ticket = dayData.sales > 0 ? dayData.revenue / dayData.sales : 0;
    
    result.push({
      date: dateStr,
      sales: dayData.sales,
      revenue: dayData.revenue,
      ticket: ticket
    });
  }

  return result;
}

/**
 * Busca estoque FULL de uma conta ML
 */
export async function getMLFullStock(accountId: string): Promise<MLFullStock[]> {
  const { data: productsData } = await supabase
    .from('mercado_livre_products')
    .select('*')
    .eq('ml_account_id', accountId);
  
  const { data: stockData, error } = await supabase
    .from('mercado_livre_full_stock')
    .select('*')
    .eq('ml_account_id', accountId)
    .order('ml_item_id');
  
  if (error) {
    throw error;
  }
  
  // Enriquecer com dados de produtos
  const productMap = new Map((productsData || []).map(p => [p.ml_item_id, p]));
  
  return (stockData || []).map(stock => ({
    ...stock,
    mercado_livre_products: productMap.get(stock.ml_item_id) ? {
      title: productMap.get(stock.ml_item_id)!.title,
      thumbnail: productMap.get(stock.ml_item_id)!.thumbnail || '',
      permalink: productMap.get(stock.ml_item_id)!.permalink || '',
      price: productMap.get(stock.ml_item_id)!.price || 0
    } : undefined
  }));
}

/**
 * Busca campanhas de Product Ads
 */
export async function getMLCampaigns(
  accountId: string,
  studentId?: string
): Promise<MLCampaign[]> {
  let query = supabase
    .from('mercado_livre_campaigns')
    .select('*')
    .eq('ml_account_id', accountId)
    .order('synced_at', { ascending: false });
  
  if (studentId) {
    query = query.eq('student_id', studentId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw error;
  }
  
  return data || [];
}

/**
 * Busca dados de qualidade (health) dos produtos
 */
export async function getMLProductHealth(accountId: string): Promise<ProductHealth[]> {
  const { data, error } = await supabase
    .from('mercado_livre_item_health')
    .select('*')
    .eq('ml_account_id', accountId);
  
  if (error) {
    console.error('Health data error:', error);
    return [];
  }
  
  return (data || []).map(item => ({
    health_score: item.health_score,
    health_level: item.health_level,
    goals: item.goals as any,
    goals_completed: item.goals_completed || 0,
    goals_applicable: item.goals_applicable || 0,
    score_trend: item.score_trend,
    previous_score: item.previous_score
  }));
}

/**
 * Busca histórico de qualidade dos produtos
 */
export async function getMLHealthHistory(
  accountId: string,
  days: number = 30
): Promise<HealthHistory[]> {
  const { data, error } = await supabase
    .from('mercado_livre_health_history')
    .select('*')
    .eq('ml_account_id', accountId)
    .gte('recorded_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('recorded_at', { ascending: true });
  
  if (error) {
    console.error('History data error:', error);
    return [];
  }
  
  const historyByDate = new Map<string, number[]>();
  (data || []).forEach(record => {
    const date = new Date(record.recorded_at).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
    if (!historyByDate.has(date)) {
      historyByDate.set(date, []);
    }
    historyByDate.get(date)!.push(record.health_score);
  });
  
  return Array.from(historyByDate.entries()).map(([date, scores]) => ({
    date,
    averageScore: (scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100
  }));
}

/**
 * Busca dados de seller recovery (Garantia de Reputação)
 */
export async function getMLSellerRecovery(accountId: string): Promise<MLSellerRecovery | null> {
  const { data, error } = await supabase
    .from('mercado_livre_seller_recovery')
    .select('*')
    .eq('ml_account_id', accountId)
    .maybeSingle();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching seller recovery:', error);
    return null;
  }
  
  return data;
}

/**
 * Busca dados completos de uma conta ML (métricas, produtos, estoque, health, seller recovery)
 */
/**
 * Busca dados essenciais de uma conta ML (otimizado)
 * Prioriza dados críticos primeiro, dados secundários depois
 */
export async function getMLAccountData(accountId: string, studentId?: string) {
  try {
    // FASE 1: Dados críticos (paralelo)
    const [metrics, products] = await Promise.all([
      getMLMetrics(accountId),
      getMLProducts(accountId, studentId),
    ]);
    
    // FASE 2: Dados secundários (paralelo, mas não bloqueia a resposta inicial)
    const secondaryDataPromise = Promise.all([
      getMLFullStock(accountId).catch(() => []),
      getMLProductHealth(accountId).catch(() => []),
      getMLHealthHistory(accountId, 30).catch(() => []),
      getMLCampaigns(accountId, studentId).catch(() => []),
      getMLSellerRecovery(accountId).catch(() => null)
    ]);
    
    // Retorna dados essenciais imediatamente
    const [stock, health, history, campaigns, sellerRecovery] = await secondaryDataPromise;
    
    // Enriquecer produtos com health data (otimizado)
    const healthMap = new Map(health.map(h => [h.ml_product_id, h]));
    
    const productsWithHealth = products.map(product => ({
      ...product,
      health: healthMap.get(product.ml_item_id) || undefined
    }));
    
    return {
      metrics,
      products: productsWithHealth,
      stock,
      health,
      history,
      campaigns,
      sellerRecovery
    };
  } catch (error) {
    console.error('Erro ao buscar dados da conta ML:', error);
    // Retorna estrutura mínima em caso de erro
    return {
      metrics: null,
      products: [],
      stock: [],
      health: [],
      history: [],
      campaigns: [],
      sellerRecovery: null
    };
  }
}

/**
 * Sincroniza dados de uma conta ML
 */
export async function syncMLAccount(accountId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('ml-sync-data', {
    body: { ml_account_id: accountId }
  });
  
  if (error) {
    throw new Error(`Erro ao sincronizar conta: ${error.message}`);
  }
}

