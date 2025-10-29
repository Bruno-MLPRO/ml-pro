// Hook customizado para buscar métricas ML

import { useQuery } from '@tanstack/react-query';
import { getMLMetrics, getMLAccountData } from '@/services/api/mercadoLivre';
import { calculateStudentMetrics, getStudentMonthlyMetrics } from '@/services/api/metrics';
import type { MLMetrics } from '@/types/mercadoLivre';

/**
 * Hook para buscar métricas de uma conta ML específica
 */
export function useMLMetrics(accountId: string | null) {
  return useQuery({
    queryKey: ['ml-metrics', accountId],
    queryFn: () => {
      if (!accountId) throw new Error('Account ID é obrigatório');
      return getMLMetrics(accountId);
    },
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000 // 2 minutos
  });
}

/**
 * Hook para calcular métricas de um estudante
 */
export function useStudentMetrics(studentId: string | null, periodDays: number = 30) {
  return useQuery({
    queryKey: ['student-metrics', studentId, periodDays],
    queryFn: () => {
      if (!studentId) throw new Error('Student ID é obrigatório');
      return calculateStudentMetrics(studentId, periodDays);
    },
    enabled: !!studentId,
    staleTime: 1 * 60 * 1000 // 1 minuto
  });
}

/**
 * Hook para buscar histórico mensal de métricas
 */
export function useStudentMonthlyMetrics(studentId: string | null) {
  return useQuery({
    queryKey: ['student-monthly-metrics', studentId],
    queryFn: () => {
      if (!studentId) throw new Error('Student ID é obrigatório');
      return getStudentMonthlyMetrics(studentId);
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000 // 5 minutos
  });
}

/**
 * Hook para buscar dados completos de uma conta ML
 */
export function useMLAccountData(accountId: string | null, studentId?: string) {
  return useQuery({
    queryKey: ['ml-account-data', accountId, studentId],
    queryFn: () => {
      if (!accountId) throw new Error('Account ID é obrigatório');
      return getMLAccountData(accountId, studentId);
    },
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000 // 2 minutos
  });
}

