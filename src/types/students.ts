// Tipos relacionados a alunos, perfis e gestão

export interface BaseStudentProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  turma: string | null;
  estado: string | null;
  estrutura_vendedor: string | null;
  tipo_pj: string | null;
  cnpj: string | null;
  cpf: string | null;
  possui_contador: boolean | null;
  caixa: number | null;
  hub_logistico: string | null;
  sistemas_externos: string | null;
  mentoria_status: string | null;
  endereco?: string | null;
  cidade?: string | null;
  cep?: string | null;
}

// Perfil completo usado em StudentDetails
export interface StudentProfile extends BaseStudentProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  turma: string;
  estado: string;
  estrutura_vendedor: string;
  tipo_pj: string | null;
  cnpj: string;
  possui_contador: boolean;
  caixa: number | null;
  hub_logistico: string;
  sistemas_externos: string;
  mentoria_status: string;
}

// Perfil usado em StudentsManagement (com informações de jornada)
export interface Student extends BaseStudentProfile {
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
  has_ml_decola?: boolean;
  has_ml_flex?: boolean;
  has_ml_full?: boolean;
  has_agencies?: boolean;
  manager_id?: string | null;
  manager_name?: string;
  journey_id?: string;
  journey_status?: string;
}

// Perfil usado em Profile.tsx (edição)
export interface ProfileData {
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  turma: string | null;
  estrutura_vendedor: string | null;
  tipo_pj: string | null;
  possui_contador: boolean | null;
  caixa: number | null;
  hub_logistico: string | null;
  sistemas_externos: string | null;
  mentoria_status: string | null;
}

// Perfil usado em StudentProfile.tsx
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

// Apps/extensões do aluno
export interface StudentApp {
  id: string;
  name: string;
  color: string;
  student_app_id?: string;
}

// Entrega de bônus
export interface BonusDelivery {
  id: string;
  bonus_id: string;
  delivered: boolean;
  delivered_at: string | null;
  delivered_by: string | null;
  notes: string | null;
  bonus: {
    name: string;
    description: string | null;
    cost: number;
  };
  deliveredByProfile?: {
    full_name: string;
  };
}

// Planos
export interface Plan {
  id: string;
  name: string;
  price: number;
}

// Gestor (usado em TeamManagement)
export interface Manager {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: 'manager' | 'administrator';
  active_students: number;
  inactive_students: number;
}

