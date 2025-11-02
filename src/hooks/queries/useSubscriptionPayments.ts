import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  SubscriptionPayment, 
  SubscriptionPaymentWithDetails, 
  MarkPaymentPaidDTO,
  PaymentStats,
  PaymentStatus
} from '@/types/financial';
import { format, startOfMonth, endOfMonth, parse } from 'date-fns';

// ==================== QUERIES ====================

// Buscar todos os pagamentos com detalhes
export function useSubscriptionPayments(filters?: {
  status?: PaymentStatus;
  month?: string; // formato: yyyy-MM
  studentId?: string;
}) {
  return useQuery({
    queryKey: ['subscription-payments', filters],
    queryFn: async (): Promise<SubscriptionPaymentWithDetails[]> => {
      let query = supabase
        .from('subscription_payments')
        .select(`
          *,
          subscription:student_subscriptions (
            student_id,
            plan_id,
            student:profiles (
              id,
              full_name,
              email
            ),
            plan:plans (
              name,
              price
            )
          )
        `)
        .order('due_date', { ascending: false });

      // Aplicar filtros
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.month) {
        const date = parse(filters.month, 'yyyy-MM', new Date());
        const start = format(startOfMonth(date), 'yyyy-MM-dd');
        const end = format(endOfMonth(date), 'yyyy-MM-dd');
        query = query.gte('due_date', start).lte('due_date', end);
      }

      if (filters?.studentId) {
        query = query.eq('subscription.student_id', filters.studentId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transformar dados
      return (data || []).map((payment: any) => ({
        ...payment,
        student_name: payment.subscription?.student?.full_name || 'N/A',
        student_email: payment.subscription?.student?.email || 'N/A',
        student_id: payment.subscription?.student_id || '',
        plan_name: payment.subscription?.plan?.name || 'N/A',
        plan_price: payment.subscription?.plan?.price || 0,
      }));
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}

// Buscar pagamentos de uma assinatura específica
export function usePaymentsBySubscription(subscriptionId: string) {
  return useQuery({
    queryKey: ['subscription-payments', subscriptionId],
    queryFn: async (): Promise<SubscriptionPayment[]> => {
      const { data, error } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    enabled: !!subscriptionId,
  });
}

// Buscar estatísticas de pagamentos
export function usePaymentStats(month?: string) {
  return useQuery({
    queryKey: ['payment-stats', month],
    queryFn: async (): Promise<PaymentStats> => {
      let query = supabase
        .from('subscription_payments')
        .select('status, amount, due_date, paid_date');

      // Filtrar por mês se especificado
      if (month) {
        const date = parse(month, 'yyyy-MM', new Date());
        const start = format(startOfMonth(date), 'yyyy-MM-dd');
        const end = format(endOfMonth(date), 'yyyy-MM-dd');
        query = query.gte('due_date', start).lte('due_date', end);
      }

      const { data, error } = await query;

      if (error) throw error;

      const payments = data || [];
      
      const totalExpected = payments.length;
      const paid = payments.filter(p => p.status === 'paid');
      const pending = payments.filter(p => p.status === 'pending');
      const overdue = payments.filter(p => p.status === 'overdue');
      
      const totalPaid = paid.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalPending = pending.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalOverdue = overdue.reduce((sum, p) => sum + Number(p.amount), 0);
      
      const paymentSuccessRate = totalExpected > 0 ? (paid.length / totalExpected) * 100 : 0;
      
      // Calcular média de dias para pagar
      const paidWithDates = paid.filter(p => p.due_date && p.paid_date);
      let avgDaysToPay = 0;
      if (paidWithDates.length > 0) {
        const totalDays = paidWithDates.reduce((sum, p) => {
          const dueDate = new Date(p.due_date!);
          const paidDate = new Date(p.paid_date!);
          const daysDiff = Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          return sum + daysDiff;
        }, 0);
        avgDaysToPay = totalDays / paidWithDates.length;
      }

      return {
        total_expected: totalExpected,
        total_paid: totalPaid,
        total_pending: totalPending,
        total_overdue: totalOverdue,
        payment_success_rate: paymentSuccessRate,
        avg_days_to_pay: avgDaysToPay,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Buscar pagamentos próximos (próximos 30 dias)
export function useUpcomingPayments() {
  return useQuery({
    queryKey: ['upcoming-payments'],
    queryFn: async (): Promise<SubscriptionPaymentWithDetails[]> => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const thirtyDaysLater = format(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        'yyyy-MM-dd'
      );

      const { data, error } = await supabase
        .from('subscription_payments')
        .select(`
          *,
          subscription:student_subscriptions (
            student_id,
            student:profiles (
              full_name,
              email
            ),
            plan:plans (
              name,
              price
            )
          )
        `)
        .eq('status', 'pending')
        .gte('due_date', today)
        .lte('due_date', thirtyDaysLater)
        .order('due_date', { ascending: true });

      if (error) throw error;

      return (data || []).map((payment: any) => ({
        ...payment,
        student_name: payment.subscription?.student?.full_name || 'N/A',
        student_email: payment.subscription?.student?.email || 'N/A',
        student_id: payment.subscription?.student_id || '',
        plan_name: payment.subscription?.plan?.name || 'N/A',
        plan_price: payment.subscription?.plan?.price || 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ==================== MUTATIONS ====================

// Marcar pagamento como pago
export function useMarkPaymentPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: MarkPaymentPaidDTO) => {
      const { error } = await supabase
        .from('subscription_payments')
        .update({
          status: 'paid',
          paid_date: dto.paid_date,
          payment_method: dto.payment_method,
          transaction_id: dto.transaction_id || null,
          notes: dto.notes || null,
        })
        .eq('id', dto.payment_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-payments'] });
      queryClient.invalidateQueries({ queryKey: ['financial-metrics'] });
    },
  });
}

// Cancelar pagamento
export function useCancelPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('subscription_payments')
        .update({ status: 'cancelled' })
        .eq('id', paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
    },
  });
}

// Atualizar pagamento
export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      paymentId, 
      updates 
    }: { 
      paymentId: string; 
      updates: Partial<SubscriptionPayment> 
    }) => {
      const { error } = await supabase
        .from('subscription_payments')
        .update(updates)
        .eq('id', paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
    },
  });
}

// Criar pagamento manual
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: {
      subscription_id: string;
      due_date: string;
      amount: number;
      status?: PaymentStatus;
    }) => {
      const { error } = await supabase
        .from('subscription_payments')
        .insert(payment);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
    },
  });
}

