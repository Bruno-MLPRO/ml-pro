import { useState, useRef } from 'react';

/**
 * Hook para gerenciar ações administrativas (sincronização, atualização de métricas)
 * Consolida a lógica de sincronização em massa e atualizações de métricas
 */
export function useAdminActions() {
  const [syncingAccounts, setSyncingAccounts] = useState(false);
  const [updatingMetrics, setUpdatingMetrics] = useState(false);
  const [metricsReloadPending, setMetricsReloadPending] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    total: number;
    current: number;
    status: string;
  } | null>(null);

  const metricsDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const startSync = () => {
    setSyncingAccounts(true);
    setSyncProgress(null);
  };

  const updateSyncProgress = (total: number, current: number, status: string) => {
    setSyncProgress({ total, current, status });
  };

  const finishSync = () => {
    setSyncingAccounts(false);
    setSyncProgress(null);
  };

  const startMetricsUpdate = () => {
    setUpdatingMetrics(true);
  };

  const finishMetricsUpdate = () => {
    setUpdatingMetrics(false);
  };

  const scheduleMetricsReload = () => {
    setMetricsReloadPending(true);
  };

  const clearMetricsReload = () => {
    setMetricsReloadPending(false);
    if (metricsDebounceRef.current) {
      clearTimeout(metricsDebounceRef.current);
      metricsDebounceRef.current = null;
    }
  };

  const cleanup = () => {
    if (metricsDebounceRef.current) {
      clearTimeout(metricsDebounceRef.current);
      metricsDebounceRef.current = null;
    }
  };

  return {
    // States
    syncingAccounts,
    updatingMetrics,
    syncProgress,
    metricsReloadPending,
    metricsDebounceRef,

    // Actions
    startSync,
    updateSyncProgress,
    finishSync,
    startMetricsUpdate,
    finishMetricsUpdate,
    scheduleMetricsReload,
    clearMetricsReload,
    cleanup,

    // Direct setters (para casos especiais)
    setSyncingAccounts,
    setUpdatingMetrics,
    setSyncProgress,
    setMetricsReloadPending,
  };
}

