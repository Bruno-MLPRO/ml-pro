// Hook customizado para métricas consolidadas (gestores)

import { useQuery } from '@tanstack/react-query';
import { getConsolidatedMetrics, getProductAdsMetrics } from '@/services/api/metrics';

/**
 * Hook para buscar métricas consolidadas de todos os alunos (gestores)
 */
export function useConsolidatedMetrics(periodDays: number = 30) {
  return useQuery({
    queryKey: ['consolidated-metrics', periodDays],
    queryFn: async () => {
      console.log('🔍 Hook useConsolidatedMetrics: Iniciando busca...');
      const result = await getConsolidatedMetrics(periodDays);
      console.log('📥 Hook useConsolidatedMetrics: Dados recebidos:', result);
      return result;
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: false
  });
}

/**
 * Hook para buscar métricas de Product Ads de múltiplas contas
 * Otimizado com cache mais longo e sem refetch no foco da janela
 */
export function useProductAdsMetrics(accountIds: string[]) {
  return useQuery({
    queryKey: ['product-ads-metrics', accountIds.sort().join(',')],
    queryFn: () => getProductAdsMetrics(accountIds),
    enabled: accountIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    refetchOnWindowFocus: false // Não refaz query ao focar a janela
  });
}

