// Hook customizado para buscar pedidos ML

import { useQuery } from '@tanstack/react-query';
import { getMLOrders } from '@/services/api/mercadoLivre';

/**
 * Hook para buscar pedidos de um estudante com paginação
 */
export function useMLOrders(
  studentId: string | null,
  periodDays: number = 30,
  status: string = 'paid'
) {
  return useQuery({
    queryKey: ['ml-orders', studentId, periodDays, status],
    queryFn: () => {
      if (!studentId) throw new Error('Student ID é obrigatório');
      return getMLOrders(studentId, periodDays, status);
    },
    enabled: !!studentId,
    staleTime: 1 * 60 * 1000, // 1 minuto
    refetchOnWindowFocus: false
  });
}

