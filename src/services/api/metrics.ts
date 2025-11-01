// Serviço de API para métricas

import { supabase } from '@/integrations/supabase/client';
import { calculateSalesMetrics, calculateAdsMetrics } from '@/lib/calculations';
import type { ConsolidatedMetrics, MonthlyMetrics, ProductAdsMetrics } from '@/types/metrics';
import { getMLOrders } from './mercadoLivre';
import { getMLCampaigns } from './mercadoLivre';
import type { MLCampaign } from '@/types/mercadoLivre';

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

/**
 * Busca métricas consolidadas para gestores (todos os alunos)
 */
export async function getConsolidatedMetrics(
  periodDays: number = 30
): Promise<ConsolidatedMetrics> {
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);

  // 1. Buscar pedidos pagos com paginação
  let allOrders: any[] = [];
  let currentPage = 0;
  let hasMore = true;

  while (hasMore && allOrders.length < 10000) {
    const rangeStart = currentPage * PAGE_SIZE;
    const rangeEnd = rangeStart + PAGE_SIZE - 1;
    
    const { data: pageOrders, error } = await supabase
      .from('mercado_livre_orders')
      .select('paid_amount, total_amount, ml_order_id')
      .eq('status', 'paid')
      .gte('date_created', periodStart.toISOString())
      .lt('date_created', periodEnd.toISOString())
      .order('date_created', { ascending: false })
      .range(rangeStart, rangeEnd);
    
    if (error) {
      throw error;
    }

    if (!pageOrders || pageOrders.length === 0) {
      hasMore = false;
      break;
    }

    allOrders = [...allOrders, ...pageOrders];

    if (pageOrders.length < PAGE_SIZE) {
      hasMore = false;
    }

    currentPage++;
  }

  // Calcular métricas de vendas
  const salesMetrics = calculateSalesMetrics(allOrders);

  // 2. Produtos por tipo de envio
  const { data: productsData, error: productsError } = await supabase
    .from('mercado_livre_products')
    .select('shipping_mode, logistic_type, shipping_modes, logistic_types')
    .eq('status', 'active');

  if (productsError) {
    throw productsError;
  }

  const total = productsData?.length || 0;
  
  // 📦 Lógica atualizada: Um produto pode contar em MÚLTIPLAS categorias
  // Exemplo: um produto pode ter ME2 (FLEX) + Custom (Correios) simultaneamente
  
  let flex = 0;
  let agencias = 0;
  let coleta = 0;
  let full = 0;
  let correios = 0;
  let envio_proprio = 0;

  for (const product of productsData || []) {
    // Verificar shipping_modes (novo campo JSONB) ou fallback para shipping_mode (compatibilidade)
    const modes = product.shipping_modes || (product.shipping_mode ? [product.shipping_mode] : []);
    const types = product.logistic_types || (product.logistic_type ? [product.logistic_type] : []);

    // Verificar se produto tem ME2 disponível
    const hasMe2 = modes.includes('me2');
    
    // Se tem ME2, verificar todos os tipos logísticos
    if (hasMe2) {
      if (types.includes('self_service') || product.logistic_type === 'self_service') flex++;
      if (types.includes('xd_drop_off') || product.logistic_type === 'xd_drop_off') agencias++;
      if (types.includes('cross_docking') || product.logistic_type === 'cross_docking') coleta++;
      if (types.includes('fulfillment') || product.logistic_type === 'fulfillment') full++;
    }

      // CORREIOS = Mercado Envios (drop_off)
      // drop_off = vendedor leva produtos ao correio ou ponto de entrega (ME1 ou ME2 com drop_off)
      const hasDropOffMode = modes.includes('drop_off') || product.shipping_mode === 'drop_off';
      const hasDropOffType = types.includes('drop_off') || (modes.includes('me2') && product.logistic_type === 'drop_off');
      if (hasDropOffMode || hasDropOffType) {
        correios++;
      }

      // ENVIO PRÓPRIO = Not Specified (not_specified)
      // Not Specified = vendedor NÃO especifica preço e deve entrar em contato com comprador
      if (modes.includes('not_specified') || product.shipping_mode === 'not_specified') {
        envio_proprio++;
      }
  }

  // 3. Métricas de Product Ads
  // As métricas já são calculadas para os últimos 30 dias quando sincronizadas
  // Buscar todas as campanhas (os campos total_spend, ad_revenue já representam os últimos 30 dias)
  const { data: campaignsData, error: campaignsError } = await supabase
    .from('mercado_livre_campaigns')
    .select('total_spend, ad_revenue, advertised_sales, status');

  if (campaignsError) {
    console.error('❌ Error loading campaigns for Product Ads metrics:', campaignsError);
    // Retornar métricas zeradas se houver erro
    return {
      totalRevenue: salesMetrics.totalRevenue,
      totalSales: salesMetrics.totalSales,
      averageTicket: salesMetrics.averageTicket,
      shippingStats: {
        correios,
        envio_proprio,
        flex,
        agencias,
        coleta,
        full,
        total
      },
      adsMetrics: {
        totalSpend: 0,
        totalRevenue: 0,
        advertisedSales: 0,
        avgRoas: 0,
        avgAcos: 0
      }
    };
  }

  console.log('📊 Campaigns found for Product Ads:', campaignsData?.length || 0);
  
  // Filtrar e calcular métricas (calculateAdsMetrics já filtra campanhas ativas)
  const adsMetrics = calculateAdsMetrics((campaignsData || []) as MLCampaign[]);
  
  console.log('💰 Calculated Product Ads metrics:', {
    totalSpend: adsMetrics.totalSpend,
    totalRevenue: adsMetrics.totalRevenue,
    totalSales: adsMetrics.totalSales
  });

  console.log('📦 Produtos por tipo de envio:', { 
    correios, 
    envio_proprio, 
    flex, 
    agencias, 
    coleta, 
    full, 
    total 
  });

  return {
    totalRevenue: salesMetrics.totalRevenue,
    totalSales: salesMetrics.totalSales,
    averageTicket: salesMetrics.averageTicket,
    shippingStats: {
      correios,
      envio_proprio,
      flex,
      agencias,
      coleta,
      full,
      total
    },
    adsMetrics: {
      totalSpend: adsMetrics.totalSpend,
      totalRevenue: adsMetrics.totalRevenue,
      advertisedSales: adsMetrics.totalSales,
      avgRoas: adsMetrics.roas,
      avgAcos: adsMetrics.acos
    }
  };
}

/**
 * Busca métricas de Product Ads para um array de contas
 * Query otimizada buscando apenas campos necessários
 */
export async function getProductAdsMetrics(accountIds: string[]): Promise<ProductAdsMetrics | null> {
  if (!accountIds || accountIds.length === 0) {
    return null;
  }

  // Query otimizada: busca apenas campos necessários para cálculo
  const { data: campaignsData, error } = await supabase
    .from('mercado_livre_campaigns')
    .select('total_spend, ad_revenue, advertised_sales, status, products_count')
    .in('ml_account_id', accountIds);

  if (error) {
    console.error('Error loading Product Ads metrics:', error);
    return null;
  }

  if (!campaignsData || campaignsData.length === 0) {
    // Retornar métricas zeradas se não houver campanhas
    return {
      totalSpend: 0,
      totalRevenue: 0,
      totalSales: 0,
      roas: 0,
      acos: 0,
      totalProductsInAds: 0,
      activeCampaigns: 0
    };
  }

  return calculateAdsMetrics((campaignsData || []) as MLCampaign[]);
}

/**
 * Busca histórico mensal de métricas de um estudante
 */
export async function getStudentMonthlyMetrics(studentId: string): Promise<MonthlyMetrics[]> {
  const { data, error } = await supabase
    .from('student_monthly_metrics')
    .select('*')
    .eq('student_id', studentId)
    .order('month', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Calcula métricas de um estudante para um período específico
 */
export async function calculateStudentMetrics(
  studentId: string,
  periodDays: number
): Promise<{
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  orderCount: number;
}> {
  const result = await getMLOrders(studentId, periodDays);
  
  const metrics = calculateSalesMetrics(result.orders);
  
  return {
    ...metrics,
    orderCount: result.totalCount
  };
}

