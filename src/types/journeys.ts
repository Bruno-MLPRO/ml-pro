// Tipos relacionados a jornadas e milestones

export interface Milestone {
  id: string;
  title: string;
  description: string;
  phase: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  order_index: number;
  order?: number;
  progress?: number;
  completed_at?: string | null;
  isExisting?: boolean;
}

export interface Journey {
  id?: string;
  overall_progress: number;
  current_phase: string;
  status?: string;
  started_at?: string;
  completed_at?: string | null;
}

export interface MilestoneTemplate {
  id?: string;
  title: string;
  description: string;
  phase: string;
  order_index: number;
  journey_template_id?: string;
  auto_validate?: boolean;
  validation_criteria?: any;
  is_active?: boolean;
}

export interface JourneyTemplate {
  id: string;
  name: string;
  description: string;
  is_default?: boolean;
  is_active?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StudentWithJourney {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  turma: string;
  cpf: string | null;
  cnpj: string | null;
  estrutura_vendedor: string;
  tipo_pj: string | null;
  possui_contador: boolean;
  caixa: number | null;
  hub_logistico: string;
  sistemas_externos: string;
  mentoria_status: string;
  current_phase?: string;
  overall_progress?: number;
  journey_id?: string;
  journey_status?: string;
  template_id?: string;
  template_name?: string;
}

export interface SortableMilestoneProps {
  milestone: MilestoneTemplate;
  isLast: boolean;
}

