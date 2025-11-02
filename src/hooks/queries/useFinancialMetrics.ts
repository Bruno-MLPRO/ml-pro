import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FinancialMetrics, MRRData, CashFlowChartData } from '@/types/financial';
import { startOfMonth, subMonths, format } from 'date-fns';

// Hook para buscar MRR atual
export function useMRR() {
  return useQuery({
    queryKey: ['financial-mrr'],
    queryFn: async (): Promise<MRRData> => {
      const { data, error } = await supabase
        .from('student_subscriptions')
        .select('monthly_price')
        .eq('status', 'active');

      if (error) throw error;

      const mrr = data?.reduce((sum, sub) => sum + Number(sub.monthly_price), 0) || 0;
      const activeStudents = data?.length || 0;
      const avgPrice = activeStudents > 0 ? mrr / activeStudents : 0;

      return {
        month: format(new Date(), 'yyyy-MM-dd'),
        active_students: activeStudents,
        mrr,
        avg_price_per_student: avgPrice,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Hook para buscar fluxo de caixa dos últimos N meses (OTIMIZADO)
export function useCashFlowChart(months: number = 12) {
  return useQuery({
    queryKey: ['cash-flow-chart', months],
    queryFn: async (): Promise<CashFlowChartData[]> => {
      const startDate = startOfMonth(subMonths(new Date(), months));

      const { data, error } = await supabase
        .from('cash_flow_entries')
        .select('type, amount, date')
        .eq('payment_status', 'confirmed')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) throw error;

      // Agrupar por mês (otimizado)
      const groupedByMonth = new Map<string, { income: number; expense: number }>();

      data?.forEach((entry) => {
        const monthKey = format(new Date(entry.date), 'MMM/yy');
        const current = groupedByMonth.get(monthKey) || { income: 0, expense: 0 };

        if (entry.type === 'income') {
          current.income += Number(entry.amount);
        } else {
          current.expense += Number(entry.amount);
        }

        groupedByMonth.set(monthKey, current);
      });

      // Converter para array
      return Array.from(groupedByMonth.entries()).map(([month, data]) => ({
        month,
        income: data.income,
        expense: data.expense,
        profit: data.income - data.expense,
      }));
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });
}

// Hook para buscar métricas financeiras consolidadas (OTIMIZADO)
export function useFinancialMetrics() {
  return useQuery({
    queryKey: ['financial-metrics'],
    queryFn: async (): Promise<FinancialMetrics> => {
      const now = new Date();
      const startOfCurrentMonth = startOfMonth(now);
      const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);

      // EXECUTA TODAS AS QUERIES EM PARALELO (Promise.all)
      const [
        subscriptionsResult,
        cashFlowYearResult,
        newStudentsResult,
        churnedStudentsResult,
      ] = await Promise.all([
        // 1. Todas as assinaturas (ativas e recentes)
        supabase
          .from('student_subscriptions')
          .select('monthly_price, student_id, status, start_date, cancelled_at')
          .or(`status.eq.active,start_date.gte.${format(startOfCurrentMonth, 'yyyy-MM-dd')},cancelled_at.gte.${format(startOfCurrentMonth, 'yyyy-MM-dd')}`),
        
        // 2. Todos os fluxos de caixa do ano (uma query só)
        supabase
          .from('cash_flow_entries')
          .select('type, amount, date, payment_status')
          .eq('payment_status', 'confirmed')
          .gte('date', format(startOfCurrentYear, 'yyyy-MM-dd')),
        
        // 3. Novos alunos do mês
        supabase
          .from('student_subscriptions')
          .select('id', { count: 'exact', head: true })
          .gte('start_date', format(startOfCurrentMonth, 'yyyy-MM-dd')),
        
        // 4. Alunos que saíram no mês
        supabase
          .from('student_subscriptions')
          .select('id', { count: 'exact', head: true })
          .in('status', ['cancelled', 'expired'])
          .gte('cancelled_at', format(startOfCurrentMonth, 'yyyy-MM-dd')),
      ]);

      // Processar assinaturas
      const subscriptions = subscriptionsResult.data || [];
      const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
      const mrr = activeSubscriptions.reduce((sum, sub) => sum + Number(sub.monthly_price), 0);
      const arr = mrr * 12;
      const activeStudents = activeSubscriptions.length;

      // Processar fluxo de caixa (uma vez só, separando por período)
      const cashFlowEntries = cashFlowYearResult.data || [];
      const startMonthStr = format(startOfCurrentMonth, 'yyyy-MM-dd');
      
      let totalRevenueMonth = 0;
      let totalRevenueYear = 0;
      let totalExpensesMonth = 0;
      let totalExpensesYear = 0;

      cashFlowEntries.forEach(entry => {
        const amount = Number(entry.amount);
        const isCurrentMonth = entry.date >= startMonthStr;
        
        if (entry.type === 'income') {
          totalRevenueYear += amount;
          if (isCurrentMonth) totalRevenueMonth += amount;
        } else {
          totalExpensesYear += amount;
          if (isCurrentMonth) totalExpensesMonth += amount;
        }
      });

      // Cálculos derivados
      const profitMonth = totalRevenueMonth - totalExpensesMonth;
      const profitYear = totalRevenueYear - totalExpensesYear;
      const profitMargin = totalRevenueMonth > 0 ? (profitMonth / totalRevenueMonth) * 100 : 0;

      // Churn e novos alunos
      const newStudentsMonth = newStudentsResult.count || 0;
      const churnedStudentsMonth = churnedStudentsResult.count || 0;
      const churnRate = activeStudents > 0 ? (churnedStudentsMonth / activeStudents) * 100 : 0;

      // Estimativas (simplificadas)
      const avgTicket = activeStudents > 0 ? mrr / activeStudents : 0;
      const ltv = avgTicket * 12; // Assumindo 12 meses de retenção média
      const cac = 500; // Valor estimado - pode ser calculado com dados reais
      const ltvCacRatio = cac > 0 ? ltv / cac : 0;

      // Saldo e runway
      const currentBalance = profitYear; // Simplificado - pode ser mantido em uma tabela separada
      const runwayMonths = totalExpensesMonth > 0 ? currentBalance / totalExpensesMonth : 0;

      return {
        mrr,
        arr,
        total_revenue_month: totalRevenueMonth,
        total_revenue_year: totalRevenueYear,
        total_expenses_month: totalExpensesMonth,
        total_expenses_year: totalExpensesYear,
        profit_month: profitMonth,
        profit_year: profitYear,
        profit_margin: profitMargin,
        active_students: activeStudents,
        new_students_month: newStudentsMonth,
        churned_students_month: churnedStudentsMonth,
        churn_rate: churnRate,
        avg_ticket: avgTicket,
        ltv,
        cac,
        ltv_cac_ratio: ltvCacRatio,
        current_balance: currentBalance,
        runway_months: runwayMonths,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });
}

