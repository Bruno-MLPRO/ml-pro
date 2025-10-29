// Tipos comuns usados em várias partes da aplicação

export interface Notice {
  id: string;
  title: string;
  content: string;
  is_important?: boolean;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  type?: 'info' | 'warning' | 'success';
  target_role?: string;
}

export interface ImportantLink {
  id: string;
  title: string;
  description: string | null;
  url: string;
  category?: string | null;
  order_index?: number;
  icon?: string | null;
  is_active?: boolean;
  target_role?: string;
}

export interface CallSchedule {
  id: string;
  date: string;
  theme: string;
  description?: string | null;
  student_id?: string;
  manager_id?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  meeting_url?: string;
  notes?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
}

