import { useQuery } from '@tanstack/react-query';
import { getMLDailyMetrics } from '@/services/api/mercadoLivre';

/**
 * Hook para buscar métricas diárias dos últimos 30 dias de uma conta ML
 */
export function useMLDailyMetrics(
  accountId: string | null,
  studentId?: string | null,
  periodDays: number = 30
) {
  return useQuery({
    queryKey: ['ml-daily-metrics', accountId, studentId, periodDays],
    queryFn: () => getMLDailyMetrics(accountId!, studentId || undefined, periodDays),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}


