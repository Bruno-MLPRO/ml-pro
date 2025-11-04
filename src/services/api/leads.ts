import { supabase } from "@/integrations/supabase/client";
import type {
  Lead,
  SalesStudent,
  CreateLeadInput,
  UpdateLeadInput,
  RegisterSaleInput,
  CreateSalesStudentInput,
  UpdateSalesStudentInput,
  LeadMetrics,
  OnboardingMetrics,
  LeadStatus
} from "@/types/leads";

// ============================================================================
// LEADS API
// ============================================================================

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select(`
      *,
      closer:closer_responsavel_id(id, full_name),
      gestor:gestor_responsavel_id(id, full_name)
    `)
    .eq('arquivado', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from('leads')
    .select(`
      *,
      closer:closer_responsavel_id(id, full_name),
      gestor:gestor_responsavel_id(id, full_name)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .insert(input)
    .select(`
      *,
      closer:closer_responsavel_id(id, full_name),
      gestor:gestor_responsavel_id(id, full_name)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateLead(id: string, input: UpdateLeadInput): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update(input)
    .eq('id', id)
    .select(`
      *,
      closer:closer_responsavel_id(id, full_name),
      gestor:gestor_responsavel_id(id, full_name)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  return updateLead(id, { status });
}

export async function registerSale(leadId: string, saleData: RegisterSaleInput): Promise<Lead> {
  // 1. Buscar dados completos do lead
  const { data: leadData, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError) throw leadError;

  // 2. Atualizar o lead com os dados da venda
  const { data: updatedLead, error: updateError } = await supabase
    .from('leads')
    .update({
      status: 'Convertido',
      produto_vendido: saleData.produto_vendido,
      valor_pago: saleData.valor_pago,
      forma_pagamento: saleData.forma_pagamento,
      data_inicio: saleData.data_inicio,
      gestor_responsavel_id: saleData.gestor_responsavel_id,
      observacoes_closer: saleData.observacoes_closer
    })
    .eq('id', leadId)
    .select(`
      *,
      closer:closer_responsavel_id(id, full_name),
      gestor:gestor_responsavel_id(id, full_name)
    `)
    .single();

  if (updateError) throw updateError;

  // 3. Verificar se já existe um registro em sales_students para este lead
  const { data: existingSalesStudent } = await supabase
    .from('sales_students')
    .select('id')
    .eq('lead_id', leadId)
    .single();

  // 4. Criar automaticamente o registro em sales_students (se não existir)
  if (!existingSalesStudent) {
    const salesStudentData: CreateSalesStudentInput = {
      lead_id: leadId,
      nome: leadData.nome,
      email: leadData.email,
      telefone: leadData.telefone,
      produto_comprado: saleData.produto_vendido,
      valor_pago: saleData.valor_pago,
      forma_pagamento: saleData.forma_pagamento,
      data_inicio: saleData.data_inicio,
      gestor_responsavel_id: saleData.gestor_responsavel_id || null,
      observacoes_closer: saleData.observacoes_closer || null,
      // Campos opcionais/padrão
      instagram: null,
      localizacao: null,
      tem_cnpj: false,
      regime_cnpj: null,
      usa_centralize: false,
      tem_contador: false,
      nome_contador: null,
      ja_vende: false,
      faturamento_mensal: null,
      investimento_estoque: null,
      meta_faturamento: null,
      atualizacoes: null,
      // Checkboxes de onboarding
      onb_call_feita: false,
      onb_catalogo_liberado: false,
      onb_memberkit_liberado: false,
      onb_grupos_ok: false,
      onb_fornecedores_ok: false,
      onb_bonus_ok: false
    };

    const { error: salesStudentError } = await supabase
      .from('sales_students')
      .insert(salesStudentData);

    if (salesStudentError) {
      console.error('❌ Erro ao criar sales_student automaticamente:', salesStudentError);
      // Não vamos lançar erro aqui para não bloquear a conversão do lead
      // O registro pode ser criado manualmente depois se necessário
    } else {
      console.log('✅ Sales student criado automaticamente para lead:', leadId);
    }
  } else {
    console.log('ℹ️ Sales student já existe para este lead:', leadId);
  }

  return updatedLead;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function archiveLead(id: string): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({ arquivado: true })
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// SALES STUDENTS API
// ============================================================================

export async function getSalesStudents(): Promise<SalesStudent[]> {
  const { data, error } = await supabase
    .from('sales_students')
    .select(`
      *,
      gestor:gestor_responsavel_id(id, full_name),
      lead:lead_id(*)
    `)
    .order('data_inicio', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getSalesStudentById(id: string): Promise<SalesStudent | null> {
  const { data, error } = await supabase
    .from('sales_students')
    .select(`
      *,
      gestor:gestor_responsavel_id(id, full_name),
      lead:lead_id(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createSalesStudent(input: CreateSalesStudentInput): Promise<SalesStudent> {
  const { data, error } = await supabase
    .from('sales_students')
    .insert(input)
    .select(`
      *,
      gestor:gestor_responsavel_id(id, full_name),
      lead:lead_id(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateSalesStudent(id: string, input: UpdateSalesStudentInput): Promise<SalesStudent> {
  const { data, error } = await supabase
    .from('sales_students')
    .update(input)
    .eq('id', id)
    .select(`
      *,
      gestor:gestor_responsavel_id(id, full_name),
      lead:lead_id(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSalesStudent(id: string): Promise<void> {
  const { error } = await supabase
    .from('sales_students')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// HANDOFF: Lead Convertido -> Sales Student -> Criar Usuário
// ============================================================================

export async function createStudentFromLead(leadId: string): Promise<{
  salesStudent: SalesStudent;
  userCreated: boolean;
}> {
  // 1. Buscar dados do lead
  const lead = await getLeadById(leadId);
  if (!lead) throw new Error('Lead não encontrado');
  if (lead.status !== 'Convertido') throw new Error('Lead não está convertido');
  if (!lead.produto_vendido || !lead.valor_pago || !lead.forma_pagamento || !lead.data_inicio || !lead.gestor_responsavel_id) {
    throw new Error('Dados da venda incompletos');
  }

  // 2. Criar sales_student
  const salesStudentData: CreateSalesStudentInput = {
    lead_id: leadId,
    nome: lead.nome,
    email: lead.email,
    telefone: lead.telefone || undefined,
    gestor_responsavel_id: lead.gestor_responsavel_id,
    produto_comprado: lead.produto_vendido,
    valor_pago: lead.valor_pago,
    forma_pagamento: lead.forma_pagamento,
    data_inicio: lead.data_inicio,
    observacoes_closer: lead.observacoes_closer || undefined
  };

  const salesStudent = await createSalesStudent(salesStudentData);

  // 3. Chamar edge function para criar usuário no sistema
  let userCreated = false;
  try {
    const { data, error } = await supabase.functions.invoke('create-student', {
      body: {
        email: lead.email,
        fullName: lead.nome,
        phone: lead.telefone,
        managerId: lead.gestor_responsavel_id
      }
    });

    if (error) {
      console.error('Erro ao criar usuário:', error);
    } else {
      userCreated = true;
      
      // 4. Atualizar sales_student com user_id e flag usuario_criado
      await supabase
        .from('sales_students')
        .update({
          user_id: data.userId,
          usuario_criado: true
        })
        .eq('id', salesStudent.id);
    }
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
  }

  // 5. Marcar lead como convertido_em_aluno e arquivar
  await supabase
    .from('leads')
    .update({
      convertido_em_aluno: true,
      arquivado: true
    })
    .eq('id', leadId);

  return {
    salesStudent,
    userCreated
  };
}

// ============================================================================
// MÉTRICAS E KPIs
// ============================================================================

export async function getLeadMetrics(): Promise<LeadMetrics> {
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('arquivado', false);

  if (error) throw error;

  const total_leads = leads?.length || 0;
  const leads_por_status = leads?.reduce((acc, lead) => {
    acc[lead.status as LeadStatus] = (acc[lead.status as LeadStatus] || 0) + 1;
    return acc;
  }, {} as Record<LeadStatus, number>) || {} as Record<LeadStatus, number>;

  const convertidos = leads?.filter(l => l.status === 'Convertido') || [];
  const taxa_conversao = total_leads > 0 ? (convertidos.length / total_leads) * 100 : 0;

  // Tempo médio de conversão (em dias)
  const conversoes_com_tempo = convertidos
    .filter(l => l.data_criacao && l.updated_at)
    .map(l => {
      const inicio = new Date(l.data_criacao);
      const fim = new Date(l.updated_at);
      return (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
    });
  const tempo_medio_conversao_dias = conversoes_com_tempo.length > 0
    ? conversoes_com_tempo.reduce((a, b) => a + b, 0) / conversoes_com_tempo.length
    : 0;

  // Volume de vendas
  const volume_vendas = convertidos.reduce((sum, l) => sum + (l.valor_pago || 0), 0);

  // Receita por origem
  const receita_por_origem = leads?.reduce((acc, lead) => {
    if (lead.status === 'Convertido' && lead.valor_pago) {
      acc[lead.origem] = (acc[lead.origem] || 0) + lead.valor_pago;
    }
    return acc;
  }, {} as Record<string, number>) || {};

  // Leads por closer (simplificado - pode ser expandido)
  const leads_por_closer: any[] = [];

  return {
    total_leads,
    leads_por_status,
    taxa_conversao,
    tempo_medio_conversao_dias,
    volume_vendas,
    receita_por_origem,
    leads_por_closer
  };
}

export async function getOnboardingMetrics(): Promise<OnboardingMetrics> {
  const { data: students, error } = await supabase
    .from('sales_students')
    .select('*');

  if (error) throw error;

  const total_alunos = students?.length || 0;

  // Tempo médio de onboarding (data_inicio até todos os checks = true)
  const onboardings_completos = students?.filter(s => 
    s.onb_call_feita && s.onb_catalogo_liberado && s.onb_memberkit_liberado &&
    s.onb_grupos_ok && s.onb_fornecedores_ok && s.onb_bonus_ok
  ) || [];

  // Tempo médio lead to call (Métrica de Ouro)
  const tempo_lead_to_call_dias = 0; // TODO: Implementar cálculo real

  // Checklist completion
  const checklist_completion = {
    call_feita: students?.filter(s => s.onb_call_feita).length || 0,
    catalogo_liberado: students?.filter(s => s.onb_catalogo_liberado).length || 0,
    memberkit_liberado: students?.filter(s => s.onb_memberkit_liberado).length || 0,
    grupos_ok: students?.filter(s => s.onb_grupos_ok).length || 0,
    fornecedores_ok: students?.filter(s => s.onb_fornecedores_ok).length || 0,
    bonus_ok: students?.filter(s => s.onb_bonus_ok).length || 0
  };

  return {
    total_alunos,
    tempo_medio_onboarding_dias: 0,
    tempo_lead_to_call_dias,
    alunos_por_gestor: [],
    checklist_completion
  };
}

// ============================================================================
// HELPERS
// ============================================================================

export async function getClosers(): Promise<Array<{ id: string; full_name: string }>> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, profiles!user_roles_user_id_fkey(id, full_name)')
    .in('role', ['administrator', 'closer']);

  if (error) throw error;
  return data?.map((item: any) => item.profiles) || [];
}

export async function getGestores(): Promise<Array<{ id: string; full_name: string }>> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      user_roles!inner(role)
    `)
    .in('user_roles.role', ['manager', 'administrator']);

  if (error) throw error;
  
  return data?.map((profile: any) => ({
    id: profile.id,
    full_name: profile.full_name
  })) || [];
}

