// Hook customizado para métricas consolidadas (gestores)

import { useQuery } from '@tanstack/react-query';
import { getConsolidatedMetrics, getProductAdsMetrics } from '@/services/api/metrics';

/**
 * Hook para buscar métricas consolidadas de todos os alunos (gestores)
 */
export function useConsolidatedMetrics(periodDays: number = 30) {
  return useQuery({
    queryKey: ['consolidated-metrics', periodDays],
    queryFn: () => getConsolidatedMetrics(periodDays),
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: false
  });
}

/**
 * Hook para buscar métricas de Product Ads de múltiplas contas
 */
export function useProductAdsMetrics(accountIds: string[]) {
  return useQuery({
    queryKey: ['product-ads-metrics', accountIds.sort().join(',')],
    queryFn: () => getProductAdsMetrics(accountIds),
    enabled: accountIds.length > 0,
    staleTime: 2 * 60 * 1000 // 2 minutos
  });
}

