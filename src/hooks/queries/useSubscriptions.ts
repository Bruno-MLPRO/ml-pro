import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  StudentSubscription,
  SubscriptionPayment,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  CreatePaymentInput,
  MarkPaymentPaidInput,
  SubscriptionFilters,
  PaymentFilters
} from '@/types/financial';
import { useToast } from '@/hooks/use-toast';

// Buscar todas as assinaturas
export function useSubscriptions(filters?: SubscriptionFilters) {
  return useQuery({
    queryKey: ['subscriptions', filters],
    queryFn: async () => {
      let query = supabase
        .from('student_subscriptions')
        .select(`
          *,
          plan:plans(*),
          student:profiles!student_subscriptions_student_id_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.plan_id) {
        query = query.eq('plan_id', filters.plan_id);
      }
      if (filters?.payment_method) {
        query = query.eq('payment_method', filters.payment_method);
      }
      if (filters?.student_search) {
        // Buscar pelo nome do aluno requer uma abordagem diferente
        // Por enquanto, vamos buscar todos e filtrar no cliente
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as StudentSubscription[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

// Buscar assinatura de um aluno específico
export function useStudentSubscription(studentId: string | null) {
  return useQuery({
    queryKey: ['student-subscription', studentId],
    queryFn: async () => {
      if (!studentId) return null;

      const { data, error } = await supabase
        .from('student_subscriptions')
        .select(`
          *,
          plan:plans(*)
        `)
        .eq('student_id', studentId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as StudentSubscription | null;
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Criar assinatura
export function useCreateSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      const { data, error } = await supabase
        .from('student_subscriptions')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['financial-mrr'] });
      toast({
        title: 'Sucesso',
        description: 'Assinatura criada com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar assinatura',
        variant: 'destructive',
      });
    },
  });
}

// Atualizar assinatura
export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateSubscriptionInput }) => {
      const updates: any = { ...input };
      
      // Se estiver cancelando, adicionar timestamp
      if (input.status === 'cancelled' && !input.cancellation_reason) {
        updates.cancelled_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('student_subscriptions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['financial-mrr'] });
      toast({
        title: 'Sucesso',
        description: 'Assinatura atualizada com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar assinatura',
        variant: 'destructive',
      });
    },
  });
}

// Buscar pagamentos de assinaturas
export function useSubscriptionPayments(filters?: PaymentFilters) {
  return useQuery({
    queryKey: ['subscription-payments', filters],
    queryFn: async () => {
      let query = supabase
        .from('subscription_payments')
        .select(`
          *,
          subscription:student_subscriptions(
            *,
            student:profiles!student_subscriptions_student_id_fkey(id, full_name, email),
            plan:plans(*)
          )
        `)
        .order('due_date', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.date_from) {
        query = query.gte('due_date', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('due_date', filters.date_to);
      }
      if (filters?.subscription_id) {
        query = query.eq('subscription_id', filters.subscription_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SubscriptionPayment[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

// Criar pagamento de assinatura
export function useCreatePayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      const { data, error } = await supabase
        .from('subscription_payments')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-payments'] });
      toast({
        title: 'Sucesso',
        description: 'Cobrança criada com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar cobrança',
        variant: 'destructive',
      });
    },
  });
}

// Marcar pagamento como pago
export function useMarkPaymentPaid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: MarkPaymentPaidInput }) => {
      const { data, error } = await supabase
        .from('subscription_payments')
        .update({
          ...input,
          status: 'paid',
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-payments'] });
      queryClient.invalidateQueries({ queryKey: ['financial-metrics'] });
      toast({
        title: 'Sucesso',
        description: 'Pagamento confirmado',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao confirmar pagamento',
        variant: 'destructive',
      });
    },
  });
}

// Cancelar pagamento
export function useCancelPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('subscription_payments')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-payments'] });
      toast({
        title: 'Sucesso',
        description: 'Pagamento cancelado',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao cancelar pagamento',
        variant: 'destructive',
      });
    },
  });
}

// Buscar pagamentos vencidos (inadimplência)
export function useOverduePayments() {
  return useQuery({
    queryKey: ['overdue-payments'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('subscription_payments')
        .select(`
          *,
          subscription:student_subscriptions(
            *,
            student:profiles!student_subscriptions_student_id_fkey(id, full_name, email)
          )
        `)
        .eq('status', 'pending')
        .lt('due_date', today)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as SubscriptionPayment[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

