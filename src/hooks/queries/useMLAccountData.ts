// Hook para dados completos de uma conta ML

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMLAccountData } from '@/services/api/mercadoLivre';
import { useEffect } from 'react';

/**
 * Hook para buscar todos os dados de uma conta ML (métricas, produtos, estoque, health, campanhas)
 * Otimizado com cache agressivo e prefetch
 */
export function useMLAccountData(accountId: string | null, studentId?: string | null) {
  return useQuery({
    queryKey: ['ml-account-data', accountId, studentId],
    queryFn: () => getMLAccountData(accountId!, studentId || undefined),
    enabled: !!accountId,
    staleTime: 10 * 60 * 1000, // 10 minutos - aumentado de 5 para 10
    gcTime: 30 * 60 * 1000, // 30 minutos - manter em cache por mais tempo
    refetchOnWindowFocus: false, // Não refetch ao focar na janela
    refetchOnMount: false, // Não refetch ao montar se já tem cache válido
  });
}

/**
 * Hook para prefetch de dados de múltiplas contas ML
 * Carrega dados em background para melhorar performance ao trocar de conta
 */
export function usePrefetchMLAccountsData(accountIds: string[], studentId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Prefetch apenas das primeiras 3 contas (para não sobrecarregar)
    const accountsToPrefetch = accountIds.slice(0, 3);
    
    accountsToPrefetch.forEach(accountId => {
      // Verifica se já tem dados em cache válidos
      const cachedData = queryClient.getQueryData(['ml-account-data', accountId, studentId]);
      
      // Se não tem cache ou está muito antigo, faz prefetch
      if (!cachedData) {
        queryClient.prefetchQuery({
          queryKey: ['ml-account-data', accountId, studentId],
          queryFn: () => getMLAccountData(accountId, studentId || undefined),
          staleTime: 10 * 60 * 1000,
        });
      }
    });
  }, [accountIds, studentId, queryClient]);
}

