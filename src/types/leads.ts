// Types for Hub de Aquisição (Leads and Sales Students)

export type LeadOrigem = 'Copping' | 'Centralize' | 'Indicação' | 'Instagram' | 'Youtube' | 'Outro';

export type LeadStatus = 'Novo' | 'Em Contato' | 'Qualificado' | 'Nutrição' | 'Convertido' | 'Desqualificado';

export type FormaPagamento = 'PIX' | 'Cartão' | 'Boleto';

export type ProdutoVendido = 'ML PRO Starter' | 'ML PRO PRO';

export interface Lead {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  origem: LeadOrigem;
  origem_outro: string | null;
  status: LeadStatus;
  closer_responsavel_id: string | null;
  data_criacao: string;
  data_ultima_interacao: string;
  lead_score: number;
  logs_de_interacao: string | null;
  
  // Dados da venda (quando convertido)
  produto_vendido: ProdutoVendido | null;
  valor_pago: number | null;
  forma_pagamento: FormaPagamento | null;
  data_inicio: string | null;
  gestor_responsavel_id: string | null;
  observacoes_closer: string | null;
  
  // Controle
  convertido_em_aluno: boolean;
  arquivado: boolean;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos (populados via join)
  closer?: {
    id: string;
    full_name: string;
  };
  gestor?: {
    id: string;
    full_name: string;
  };
}

export interface SalesStudent {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  
  // Dados básicos
  nome: string;
  email: string;
  telefone: string | null;
  instagram: string | null;
  localizacao: string | null;
  
  // Dados de negócio
  tem_cnpj: boolean;
  regime_cnpj: string | null;
  usa_centralize: boolean;
  tem_contador: boolean;
  nome_contador: string | null;
  ja_vende: boolean;
  faturamento_mensal: number | null;
  investimento_estoque: number | null;
  meta_faturamento: number | null;
  
  // Dados da venda
  gestor_responsavel_id: string | null;
  produto_comprado: ProdutoVendido;
  valor_pago: number;
  forma_pagamento: FormaPagamento;
  data_inicio: string;
  observacoes_closer: string | null;
  
  // Checklist de Onboarding
  onb_call_feita: boolean;
  onb_catalogo_liberado: boolean;
  onb_memberkit_liberado: boolean;
  onb_grupos_ok: boolean;
  onb_fornecedores_ok: boolean;
  onb_bonus_ok: boolean;
  
  // Atualizações/Anotações
  atualizacoes: string | null;
  
  // Controle
  usuario_criado: boolean;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos (populados via join)
  gestor?: {
    id: string;
    full_name: string;
  };
  lead?: Lead;
}

export interface CreateLeadInput {
  nome: string;
  email: string;
  telefone?: string;
  origem: LeadOrigem;
  origem_outro?: string;
  closer_responsavel_id?: string;
  lead_score?: number;
  logs_de_interacao?: string;
}

export interface UpdateLeadInput {
  nome?: string;
  email?: string;
  telefone?: string;
  origem?: LeadOrigem;
  origem_outro?: string;
  status?: LeadStatus;
  closer_responsavel_id?: string;
  lead_score?: number;
  logs_de_interacao?: string;
}

export interface RegisterSaleInput {
  produto_vendido: ProdutoVendido;
  valor_pago: number;
  forma_pagamento: FormaPagamento;
  data_inicio: string;
  gestor_responsavel_id?: string;  // Opcional - será atribuído no painel de Gestão de Alunos
  observacoes_closer?: string;
}

export interface CreateSalesStudentInput {
  lead_id: string;
  nome: string;
  email: string;
  telefone?: string;
  instagram?: string;
  localizacao?: string;
  
  // Dados de negócio
  tem_cnpj?: boolean;
  regime_cnpj?: string;
  usa_centralize?: boolean;
  tem_contador?: boolean;
  nome_contador?: string;
  ja_vende?: boolean;
  faturamento_mensal?: number;
  investimento_estoque?: number;
  meta_faturamento?: number;
  
  // Dados da venda
  gestor_responsavel_id: string;
  produto_comprado: ProdutoVendido;
  valor_pago: number;
  forma_pagamento: FormaPagamento;
  data_inicio: string;
  observacoes_closer?: string;
}

export interface UpdateSalesStudentInput {
  instagram?: string;
  localizacao?: string;
  tem_cnpj?: boolean;
  regime_cnpj?: string;
  usa_centralize?: boolean;
  tem_contador?: boolean;
  nome_contador?: string;
  ja_vende?: boolean;
  faturamento_mensal?: number;
  investimento_estoque?: number;
  meta_faturamento?: number;
  gestor_responsavel_id?: string;
  atualizacoes?: string;
  
  // Checklist
  onb_call_feita?: boolean;
  onb_catalogo_liberado?: boolean;
  onb_memberkit_liberado?: boolean;
  onb_grupos_ok?: boolean;
  onb_fornecedores_ok?: boolean;
  onb_bonus_ok?: boolean;
}

// Métricas para KPIs
export interface LeadMetrics {
  total_leads: number;
  leads_por_status: Record<LeadStatus, number>;
  taxa_conversao: number; // Convertidos / Total
  tempo_medio_conversao_dias: number;
  volume_vendas: number; // Total em R$
  receita_por_origem: Record<LeadOrigem, number>;
  leads_por_closer: Array<{
    closer_id: string;
    closer_nome: string;
    total_leads: number;
    convertidos: number;
    taxa_conversao: number;
    volume_vendas: number;
  }>;
}

export interface OnboardingMetrics {
  total_alunos: number;
  tempo_medio_onboarding_dias: number;
  tempo_lead_to_call_dias: number; // Métrica de Ouro
  alunos_por_gestor: Array<{
    gestor_id: string;
    gestor_nome: string;
    total_alunos: number;
    onboarding_completo: number;
    tempo_medio_onboarding: number;
  }>;
  checklist_completion: {
    call_feita: number;
    catalogo_liberado: number;
    memberkit_liberado: number;
    grupos_ok: number;
    fornecedores_ok: number;
    bonus_ok: number;
  };
}

