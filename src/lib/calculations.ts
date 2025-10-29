// Funções de cálculo centralizadas

import type { MLCampaign, MLProduct, ProductAdsMetrics, ShippingStats } from '@/types/metrics';

/**
 * Calcula métricas de Product Ads a partir de campanhas
 */
export function calculateAdsMetrics(campaigns: MLCampaign[]): ProductAdsMetrics {
  if (!campaigns || campaigns.length === 0) {
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

  const activeCampaigns = campaigns.filter(c => 
    c.status === 'active' || c.status === 'enabled'
  );

  const totalSpend = activeCampaigns.reduce((sum, c) => sum + (Number(c.total_spend) || 0), 0);
  const totalRevenue = activeCampaigns.reduce((sum, c) => sum + (Number(c.ad_revenue) || 0), 0);
  const totalSales = activeCampaigns.reduce((sum, c) => sum + (Number(c.advertised_sales) || 0), 0);
  const totalProductsInAds = activeCampaigns.reduce((sum, c) => sum + (c.advertised_sales || 0), 0);

  return {
    totalSpend,
    totalRevenue,
    totalSales,
    roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    acos: totalRevenue > 0 ? (totalSpend / totalRevenue) * 100 : 0,
    totalProductsInAds,
    activeCampaigns: activeCampaigns.length
  };
}

/**
 * Calcula estatísticas de tipos de envio a partir de produtos (formato completo com objetos)
 * Separa Correios (custom) de Envio Próprio (not_specified)
 */
export function calculateShippingStats(products: MLProduct[]): ShippingStats {
  if (!products || products.length === 0) {
    return {
      flex: { count: 0, percentage: 0 },
      agencies: { count: 0, percentage: 0 },
      collection: { count: 0, percentage: 0 },
      full: { count: 0, percentage: 0 },
      correios: { count: 0, percentage: 0 },
      envio_proprio: { count: 0, percentage: 0 },
      total: 0
    };
  }

  const activeProducts = products.filter(p => p.status === 'active');
  const total = activeProducts.length;

  // 📦 Lógica atualizada: Um produto pode contar em MÚLTIPLAS categorias
  // Exemplo: um produto pode ter ME2 (FLEX) + Custom (Correios) simultaneamente
  
  let flex = 0;
  let agencies = 0;
  let collection = 0;
  let full = 0;
  let correios = 0;
  let envio_proprio = 0;

  for (const product of activeProducts) {
    // Verificar shipping_modes (novo campo JSONB) ou fallback para shipping_mode (compatibilidade)
    const modes = product.shipping_modes || (product.shipping_mode ? [product.shipping_mode] : []);
    const types = product.logistic_types || (product.logistic_type ? [product.logistic_type] : []);

    // Verificar se produto tem ME2 disponível
    const hasMe2 = modes.includes('me2');
    
    // Se tem ME2, verificar todos os tipos logísticos
    if (hasMe2) {
      // Verificar tipos específicos (pode ter múltiplos)
      if (types.includes('self_service')) flex++;
      if (types.includes('xd_drop_off')) agencies++;
      if (types.includes('cross_docking')) collection++;
      if (types.includes('fulfillment')) full++;
      
      // Fallback para compatibilidade: se não tem types no array, usar logistic_type único
      if (types.length === 0 && product.logistic_type) {
        if (product.logistic_type === 'self_service') flex++;
        else if (product.logistic_type === 'xd_drop_off') agencies++;
        else if (product.logistic_type === 'cross_docking') collection++;
        else if (product.logistic_type === 'fulfillment') full++;
      }
    }

    // CORREIOS = Mercado Envios (drop_off)
    // drop_off = vendedor leva produtos ao correio ou ponto de entrega (ME1 ou ME2 com drop_off)
    // Pode aparecer como: mode = 'drop_off' (ME1) OU mode = 'me2' com logistic_type = 'drop_off'
    if (modes.includes('drop_off')) {
      correios++;
    }
    if (types.includes('drop_off')) {
      correios++;
    }
    // Fallback para compatibilidade: produtos antigos
    if (!product.shipping_modes && product.shipping_mode === 'drop_off') {
      correios++;
    }
    if (!product.logistic_types && hasMe2 && product.logistic_type === 'drop_off') {
      correios++;
    }

    // ENVIO PRÓPRIO = Not Specified (not_specified)
    // Not Specified = vendedor NÃO especifica preço e deve entrar em contato com comprador para coordenar
    if (modes.includes('not_specified')) {
      envio_proprio++;
    }
    // Fallback para compatibilidade: produtos antigos sem shipping_modes
    if (!product.shipping_modes && product.shipping_mode === 'not_specified') {
      envio_proprio++;
    }
  }

  return {
    flex: { count: flex, percentage: total > 0 ? (flex / total) * 100 : 0 },
    agencies: { count: agencies, percentage: total > 0 ? (agencies / total) * 100 : 0 },
    collection: { count: collection, percentage: total > 0 ? (collection / total) * 100 : 0 },
    full: { count: full, percentage: total > 0 ? (full / total) * 100 : 0 },
    correios: { count: correios, percentage: total > 0 ? (correios / total) * 100 : 0 },
    envio_proprio: { count: envio_proprio, percentage: total > 0 ? (envio_proprio / total) * 100 : 0 },
    total
  };
}

/**
 * Calcula estatísticas de tipos de envio (formato simples para compatibilidade)
 */
export function calculateShippingStatsSimple(products: MLProduct[]): {
  flex: number;
  agencies: number;
  collection: number;
  full: number;
  correios: number;
  envio_proprio: number;
  total: number;
} {
  const stats = calculateShippingStats(products);
  
  return {
    flex: stats.flex.count,
    agencies: stats.agencies.count,
    collection: stats.collection.count,
    full: stats.full.count,
    correios: stats.correios.count,
    envio_proprio: stats.envio_proprio.count,
    total: stats.total
  };
}

/**
 * Verifica se um produto tem um tipo específico de envio
 * Considera múltiplos tipos por produto
 */
export function hasShippingType(
  product: MLProduct, 
  type: 'flex' | 'agencias' | 'coleta' | 'full' | 'correios' | 'envio_proprio'
): boolean {
  const modes = product.shipping_modes || (product.shipping_mode ? [product.shipping_mode] : []);
  const types = product.logistic_types || (product.logistic_type ? [product.logistic_type] : []);

  switch (type) {
    case 'flex':
      return modes.includes('me2') && (types.includes('self_service') || product.logistic_type === 'self_service');
    case 'agencias':
      return modes.includes('me2') && (types.includes('xd_drop_off') || product.logistic_type === 'xd_drop_off');
    case 'coleta':
      return modes.includes('me2') && (types.includes('cross_docking') || product.logistic_type === 'cross_docking');
    case 'full':
      return modes.includes('me2') && (types.includes('fulfillment') || product.logistic_type === 'fulfillment');
    case 'correios':
      // CORREIOS = Mercado Envios (drop_off) - vendedor leva ao correio ou ponto de entrega
      const hasDropOffMode = modes.includes('drop_off') || product.shipping_mode === 'drop_off';
      const hasDropOffType = types.includes('drop_off') || (modes.includes('me2') && product.logistic_type === 'drop_off');
      return hasDropOffMode || hasDropOffType;
    case 'envio_proprio':
      // ENVIO PRÓPRIO = Not Specified (not_specified) - vendedor entra em contato com comprador
      return modes.includes('not_specified') || product.shipping_mode === 'not_specified';
    default:
      return false;
  }
}

/**
 * Calcula métricas de vendas a partir de pedidos
 */
export function calculateSalesMetrics(orders: any[]) {
  const totalSales = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_amount || o.paid_amount) || 0), 0);
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  return {
    totalSales,
    totalRevenue,
    averageTicket
  };
}

/**
 * Normaliza ID de produto do Mercado Livre
 */
export function normalizeProductId(input: string): string {
  const trimmed = input.trim();
  
  if (trimmed.toLowerCase().startsWith('http')) {
    const match = trimmed.match(/(ML[ABM]-?\d+)/i);
    return match ? match[1].toUpperCase().replace('-', '') : '';
  }
  
  if (/^ML[ABM]\d+$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^\d+$/.test(trimmed)) return `MLB${trimmed}`;
  
  return trimmed.toUpperCase();
}

