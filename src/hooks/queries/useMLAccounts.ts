// Hook customizado para buscar contas ML

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMLAccounts, syncMLAccount } from '@/services/api/mercadoLivre';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook para buscar contas ML do estudante logado
 */
export function useMLAccounts() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['ml-accounts', user?.id],
    queryFn: () => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      return getMLAccounts(user.id);
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: false
  });
}

/**
 * Hook para sincronizar uma conta ML
 */
export function useSyncMLAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (accountId: string) => syncMLAccount(accountId),
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['ml-accounts', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['ml-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['ml-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ml-products'] });
    }
  });
}

