// Serviço de API para métricas
// ⚠️ REFATORADO: Agora usa a camada de domínio para cálculos de shipping

import { supabase } from '@/integrations/supabase/client';
import { calculateSalesMetrics, calculateAdsMetrics } from '@/lib/calculations';
import { productMapper } from '@/domain/mappers/ProductMapper';
import { shippingCalculator } from '@/domain/services/ShippingCalculator';
import type { ConsolidatedMetrics, MonthlyMetrics, ProductAdsMetrics } from '@/types/metrics';
import { getMLOrders } from './mercadoLivre';
import { getMLCampaigns } from './mercadoLivre';
import type { MLCampaign, MLProduct } from '@/types/mercadoLivre';

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

/**
 * Busca métricas consolidadas para gestores (todos os alunos)
 */
export async function getConsolidatedMetrics(
  periodDays: number = 30
): Promise<ConsolidatedMetrics> {
  console.log('🚀 getConsolidatedMetrics: Iniciando busca de métricas consolidadas...');
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

  console.log(`📊 Total de pedidos encontrados: ${allOrders.length}`);

  // Calcular métricas de vendas
  const salesMetrics = calculateSalesMetrics(allOrders);
  console.log('💰 Métricas de vendas calculadas:', salesMetrics);

  // 2. Produtos por tipo de envio
  // ✅ REFATORADO: Agora usa ShippingCalculator da camada de domínio
  // Query simplificada: apenas campos necessários para cálculo de shipping
  const { data: productsData, error: productsError } = await supabase
    .from('mercado_livre_products')
    .select('id, status, shipping_mode, logistic_type, shipping_modes, logistic_types')
    .eq('status', 'active');
  
  console.log(`📦 Total de produtos ativos encontrados: ${productsData?.length || 0}`);
  
  if (productsError) {
    console.error('❌ Erro ao buscar produtos:', productsError);
    // Se houver erro, continuar com shipping stats zerados ao invés de quebrar
    return {
      totalRevenue: salesMetrics.totalRevenue,
      totalSales: salesMetrics.totalSales,
      averageTicket: salesMetrics.averageTicket,
      shippingStats: {
        correios: 0,
        envio_proprio: 0,
        flex: 0,
        agencias: 0,
        coleta: 0,
        full: 0,
        total: 0
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

  // Converter produtos para modelos de domínio e calcular estatísticas
  // Cast para MLProduct[] com campos mínimos necessários
  const domainProducts = productMapper.toDomainArray((productsData || []) as any as MLProduct[]);
  console.log(`🔄 Produtos convertidos para domínio: ${domainProducts.length}`);
  
  const shippingStats = shippingCalculator.calculateSimple(domainProducts);
  console.log('📊 Estatísticas de shipping calculadas:', shippingStats);
  
  const { flex, agencies: agencias, collection: coleta, full, correios, envio_proprio, total } = shippingStats;

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

  const result = {
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

  console.log('✅ Métricas consolidadas finais:', result);
  return result;
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

