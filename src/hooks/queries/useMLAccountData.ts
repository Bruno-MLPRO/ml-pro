// Hook para dados completos de uma conta ML

import { useQuery } from '@tanstack/react-query';
import { getMLAccountData } from '@/services/api/mercadoLivre';

/**
 * Hook para buscar todos os dados de uma conta ML (métricas, produtos, estoque, health, campanhas)
 */
export function useMLAccountData(accountId: string | null, studentId?: string | null) {
  return useQuery({
    queryKey: ['ml-account-data', accountId, studentId],
    queryFn: () => getMLAccountData(accountId!, studentId || undefined),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

