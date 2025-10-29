// Tipos relacionados a métricas e cálculos

export interface ShippingStats {
  flex: { count: number; percentage: number };
  agencies: { count: number; percentage: number };
  collection: { count: number; percentage: number };
  full: { count: number; percentage: number };
  correios: { count: number; percentage: number };
  envio_proprio: { count: number; percentage: number };
  total: number;
}

export interface ProductAdsMetrics {
  totalSpend: number;
  totalRevenue: number;
  totalSales: number;
  roas: number;
  acos: number;
  totalProductsInAds?: number;
  activeCampaigns?: number;
}

export interface StudentMetrics {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  shippingStats: ShippingStats;
  productAdsMetrics?: ProductAdsMetrics;
}

export interface ConsolidatedMetrics {
  totalRevenue: number;
  totalSales: number;
  averageTicket: number;
  shippingStats: {
    correios: number;
    envio_proprio: number;
    flex: number;
    agencias: number;
    coleta: number;
    full: number;
    total: number;
  };
  adsMetrics: {
    totalSpend: number;
    totalRevenue: number;
    advertisedSales: number;
    avgRoas: number;
    avgAcos: number;
  };
}

export interface MonthlyMetrics {
  id: string;
  student_id: string;
  month: string;
  total_sales: number;
  total_revenue: number;
  average_ticket: number;
  product_ads_spend: number;
  product_ads_revenue: number;
  product_ads_roas: number;
  product_ads_acos: number;
  flex_products: number;
  agencias_products: number;
  coleta_products: number;
  full_products: number;
  correios_products: number;
  envio_proprio_products: number;
  ads_total_spend?: number;
}

export interface PaginatedOrdersResult {
  orders: any[];
  totalCount: number;
  hasMore: boolean;
  limitReached: boolean;
}

