import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  CashFlowEntry, 
  CashFlowCategory, 
  CreateCashFlowEntryInput,
  UpdateCashFlowEntryInput,
  CashFlowFilters 
} from '@/types/financial';
import { useToast } from '@/hooks/use-toast';

// Buscar categorias de fluxo de caixa
export function useCashFlowCategories() {
  return useQuery({
    queryKey: ['cash-flow-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_flow_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as CashFlowCategory[];
    },
    staleTime: 30 * 60 * 1000, // 30 minutos (categorias mudam pouco)
  });
}

// Buscar entradas de fluxo de caixa com filtros
export function useCashFlowEntries(filters?: CashFlowFilters) {
  return useQuery({
    queryKey: ['cash-flow-entries', filters],
    queryFn: async () => {
      let query = supabase
        .from('cash_flow_entries')
        .select(`
          *,
          category:cash_flow_categories(*)
        `)
        .order('date', { ascending: false });

      // Aplicar filtros
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      if (filters?.payment_status) {
        query = query.eq('payment_status', filters.payment_status);
      }
      if (filters?.date_from) {
        query = query.gte('date', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('date', filters.date_to);
      }
      if (filters?.related_to_type) {
        query = query.eq('related_to_type', filters.related_to_type);
      }
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CashFlowEntry[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

// Criar entrada de fluxo de caixa
export function useCreateCashFlowEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateCashFlowEntryInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('cash_flow_entries')
        .insert({
          ...input,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-flow-entries'] });
      queryClient.invalidateQueries({ queryKey: ['financial-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow-chart'] });
      toast({
        title: 'Sucesso',
        description: 'Entrada registrada no fluxo de caixa',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao registrar entrada',
        variant: 'destructive',
      });
    },
  });
}

// Atualizar entrada de fluxo de caixa
export function useUpdateCashFlowEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCashFlowEntryInput }) => {
      const { data, error } = await supabase
        .from('cash_flow_entries')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-flow-entries'] });
      queryClient.invalidateQueries({ queryKey: ['financial-metrics'] });
      toast({
        title: 'Sucesso',
        description: 'Entrada atualizada com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar entrada',
        variant: 'destructive',
      });
    },
  });
}

// Deletar entrada de fluxo de caixa
export function useDeleteCashFlowEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cash_flow_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-flow-entries'] });
      queryClient.invalidateQueries({ queryKey: ['financial-metrics'] });
      toast({
        title: 'Sucesso',
        description: 'Entrada removida do fluxo de caixa',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover entrada',
        variant: 'destructive',
      });
    },
  });
}

// Buscar entradas recorrentes pendentes de geração
export function useRecurringEntries() {
  return useQuery({
    queryKey: ['recurring-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_flow_entries')
        .select('*')
        .eq('is_recurring', true)
        .eq('payment_status', 'confirmed')
        .is('parent_entry_id', null)
        .or(`recurrence_end_date.is.null,recurrence_end_date.gte.${new Date().toISOString()}`);

      if (error) throw error;
      return data as CashFlowEntry[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}

