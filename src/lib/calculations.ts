// Funções de cálculo centralizadas
// ⚠️ REFATORADO: Agora usa a camada de domínio para cálculos de shipping

import type { MLCampaign, MLProduct, ProductAdsMetrics, ShippingStats } from '@/types/metrics';
import { productMapper } from '@/domain/mappers/ProductMapper';
import { shippingCalculator } from '@/domain/services/ShippingCalculator';

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
  // Usar products_count se disponível, senão usar advertised_sales como fallback
  const totalProductsInAds = activeCampaigns.reduce((sum, c) => sum + (Number(c.products_count || c.advertised_sales) || 0), 0);

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
 * ✅ REFATORADO: Agora delega para ShippingCalculator da camada de domínio
 * Separa Correios (custom) de Envio Próprio (not_specified)
 */
export function calculateShippingStats(products: MLProduct[]): ShippingStats {
  // Converte produtos brutos para modelos de domínio
  const domainProducts = productMapper.toDomainArray(products);
  
  // Delega cálculo para o serviço de domínio
  return shippingCalculator.calculate(domainProducts);
}

/**
 * Calcula estatísticas de tipos de envio (formato simples para compatibilidade)
 * ✅ REFATORADO: Agora usa ShippingCalculator
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
  // Converte para domínio e calcula
  const domainProducts = productMapper.toDomainArray(products);
  return shippingCalculator.calculateSimple(domainProducts);
}

/**
 * Verifica se um produto tem um tipo específico de envio
 * ✅ REFATORADO: Agora usa modelo de domínio Product
 * Considera múltiplos tipos por produto
 */
export function hasShippingType(
  product: MLProduct, 
  type: 'flex' | 'agencias' | 'coleta' | 'full' | 'correios' | 'envio_proprio'
): boolean {
  // Converte para modelo de domínio
  const domainProduct = productMapper.toDomain(product);
  
  // Mapeia nomes para métodos do domínio
  const typeMap = {
    'flex': 'flex' as const,
    'agencias': 'agencies' as const,
    'coleta': 'collection' as const,
    'full': 'full' as const,
    'correios': 'correios' as const,
    'envio_proprio': 'envio_proprio' as const
  };
  
  return shippingCalculator.hasShippingType(domainProduct, typeMap[type]);
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

