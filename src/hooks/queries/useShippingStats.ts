// Hook para buscar e calcular shipping stats otimizado

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateShippingStats } from '@/lib/calculations';
import type { ShippingStats } from '@/types/metrics';

/**
 * Hook otimizado para buscar shipping stats de um estudante
 * Usa cache do React Query para evitar queries repetidas
 * Aceita accountIds ou usa student_id como fallback para carregamento mais rápido
 */
export function useShippingStats(studentId: string | null, accountIds: string[]) {
  return useQuery({
    queryKey: ['shipping-stats', studentId, accountIds.sort().join(',')],
    queryFn: async (): Promise<ShippingStats | null> => {
      if (!studentId) {
        return null;
      }

      // Query otimizada: busca apenas campos necessários
      // Tenta usar accountIds primeiro (mais eficiente), mas usa student_id como fallback
      let query = supabase
        .from('mercado_livre_products')
        .select('shipping_mode, logistic_type, shipping_modes, logistic_types, status')
        .eq('status', 'active');

      // Se temos accountIds, usa eles (mais eficiente devido ao índice)
      // Caso contrário, usa student_id (ainda é rápido devido ao índice idx_ml_products_student)
      if (accountIds.length > 0) {
        query = query.in('ml_account_id', accountIds);
      } else {
        query = query.eq('student_id', studentId);
      }

      const { data: products, error } = await query;

      if (error) {
        console.error('Error loading shipping stats:', error);
        return null;
      }

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

      return calculateShippingStats(products as any);
    },
    enabled: !!studentId, // Executa assim que tiver studentId, mesmo sem accountIds
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    refetchOnWindowFocus: false,
    // Prioriza dados em cache se disponível
    placeholderData: (previousData) => previousData
  });
}

