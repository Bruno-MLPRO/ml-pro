import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConsolidatedMonthlyMetric {
  id: string;
  reference_month: string;
  period_start: string;
  period_end: string;
  total_revenue: number;
  total_sales: number;
  ads_total_spend: number;
  ads_total_revenue: number;
  ads_total_sales: number;
  ads_roas: number;
  ads_acos: number;
  shipping_correios: number;
  shipping_flex: number;
  shipping_agencias: number;
  shipping_coleta: number;
  shipping_full: number;
  calculated_at: string;
  created_at: string;
}

export function useConsolidatedMonthlyMetrics() {
  return useQuery({
    queryKey: ['consolidated-monthly-metrics'],
    queryFn: async () => {
      console.log('🔍 Buscando métricas consolidadas mensais...');
      
      const { data, error } = await supabase
        .from('consolidated_metrics_monthly')
        .select('*')
        .order('reference_month', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar métricas consolidadas mensais:', error);
        console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
        throw error;
      }

      console.log('✅ Métricas encontradas:', data?.length || 0);
      console.log('📊 Dados:', data);

      return (data || []) as ConsolidatedMonthlyMetric[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });
}

