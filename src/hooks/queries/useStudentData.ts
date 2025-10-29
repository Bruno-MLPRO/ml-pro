// Hooks para dados de estudantes

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  getStudentProfile,
  getStudentMLAccounts,
  getStudentApps,
  getStudentJourneys,
  getJourneyTemplates,
  getAvailableApps,
  getStudentBonusDeliveries,
  getConsolidatedAccountMetrics
} from '@/services/api/students';

/**
 * Hook para buscar perfil de um estudante
 */
export function useStudentProfile(studentId: string | null) {
  return useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: () => getStudentProfile(studentId!),
    enabled: !!studentId,
  });
}

/**
 * Hook para buscar contas ML de um estudante
 */
export function useStudentMLAccounts(studentId: string | null) {
  return useQuery({
    queryKey: ['student-ml-accounts', studentId],
    queryFn: () => getStudentMLAccounts(studentId!),
    enabled: !!studentId,
  });
}

/**
 * Hook para buscar apps atribuídos a um estudante
 */
export function useStudentApps(studentId: string | null) {
  return useQuery({
    queryKey: ['student-apps', studentId],
    queryFn: () => getStudentApps(studentId!),
    enabled: !!studentId,
  });
}

/**
 * Hook para buscar jornadas de um estudante
 */
export function useStudentJourneys(studentId: string | null) {
  return useQuery({
    queryKey: ['student-journeys', studentId],
    queryFn: () => getStudentJourneys(studentId!),
    enabled: !!studentId,
  });
}

/**
 * Hook para buscar templates de jornadas
 */
export function useJourneyTemplates() {
  return useQuery({
    queryKey: ['journey-templates'],
    queryFn: getJourneyTemplates,
  });
}

/**
 * Hook para buscar apps disponíveis
 */
export function useAvailableApps() {
  return useQuery({
    queryKey: ['available-apps'],
    queryFn: getAvailableApps,
  });
}

/**
 * Hook para buscar entregas de bônus de um estudante
 */
export function useStudentBonusDeliveries(studentId: string | null) {
  return useQuery({
    queryKey: ['student-bonus-deliveries', studentId],
    queryFn: () => getStudentBonusDeliveries(studentId!),
    enabled: !!studentId,
  });
}

/**
 * Hook para buscar métricas consolidadas de múltiplas contas
 */
export function useConsolidatedAccountMetrics(
  accountIds: string[],
  studentId: string | null
) {
  return useQuery({
    queryKey: ['consolidated-account-metrics', accountIds, studentId],
    queryFn: () => getConsolidatedAccountMetrics(accountIds, studentId!),
    enabled: !!studentId && accountIds.length > 0,
  });
}

