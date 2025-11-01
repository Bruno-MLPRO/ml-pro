import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Notice, ImportantLink, CallSchedule } from '@/types/common';

/**
 * Hook para gerenciar dados do dashboard (avisos, links importantes e agendamentos)
 * Consolida a lógica de busca e estado que estava dispersa nos componentes
 */
export function useDashboardData(userId: string | undefined, userRole: string | undefined) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [importantLinks, setImportantLinks] = useState<ImportantLink[]>([]);
  const [callSchedules, setCallSchedules] = useState<CallSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId || !userRole) {
      setLoading(false);
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userRole]);

  const loadData = async () => {
    if (!userId || !userRole) return;

    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        loadNotices(),
        loadImportantLinks(),
        loadCallSchedules(),
      ]);
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err);
      setError(err instanceof Error ? err : new Error('Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const loadNotices = async () => {
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('is_active', true)
        .in('target_role', [userRole!, 'all'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotices(data || []);
    } catch (error) {
      console.error('Erro ao carregar avisos:', error);
      throw error;
    }
  };

  const loadImportantLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('important_links')
        .select('*')
        .eq('is_active', true)
        .in('target_role', [userRole!, 'all'])
        .order('order_index', { ascending: true });

      if (error) throw error;
      setImportantLinks(data || []);
    } catch (error) {
      console.error('Erro ao carregar links importantes:', error);
      throw error;
    }
  };

  const loadCallSchedules = async () => {
    if (userRole !== 'student') return;

    try {
      const { data, error } = await supabase
        .from('call_schedules')
        .select('*')
        .eq('student_id', userId!)
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(5);

      if (error) throw error;
      setCallSchedules(data || []);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      throw error;
    }
  };

  return {
    notices,
    importantLinks,
    callSchedules,
    loading,
    error,
    refetch: loadData,
    setNotices,
    setImportantLinks,
    setCallSchedules,
  };
}

