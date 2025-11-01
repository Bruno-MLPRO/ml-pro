// Serviço de API para dados de estudantes

import { supabase } from '@/integrations/supabase/client';
import type { MLAccount } from '@/types/mercadoLivre';
import type { MLMetrics } from '@/types/mercadoLivre';

export interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentApp {
  student_app_id: string;
  id: string;
  name: string;
  color: string;
}

export interface StudentJourney {
  id: string;
  current_phase: string;
  overall_progress: number;
  student_id: string;
}

export interface JourneyTemplate {
  id: string;
  name: string;
  is_default: boolean;
}

export interface BonusDelivery {
  id: string;
  bonus_id: string;
  delivered_at: string;
  expires_at: string | null;
  status: string;
}

/**
 * Busca perfil de um estudante
 */
export async function getStudentProfile(studentId: string): Promise<any> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', studentId)
    .single();

  if (error) {
    throw error;
  }

  // Retornar todos os campos incluindo os que não estão no tipo base
  return data as any;
}

/**
 * Busca contas ML de um estudante (versão simplificada)
 */
export async function getStudentMLAccounts(studentId: string): Promise<MLAccount[]> {
  const { data, error } = await supabase
    .from('mercado_livre_accounts')
    .select('id, ml_nickname, ml_user_id, is_primary, is_active, connected_at, last_sync_at')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false });

  if (error) {
    throw error;
  }

  // Transformar para o formato esperado
  return (data || []).map(acc => ({
    id: acc.id,
    student_id: studentId,
    ml_user_id: acc.ml_user_id,
    nickname: acc.ml_nickname,
    email: '',
    access_token: '',
    refresh_token: '',
    token_expires_at: '',
    account_type: '',
    site_id: '',
    last_sync_at: acc.last_sync_at,
    is_primary: acc.is_primary,
    is_active: acc.is_active,
    created_at: acc.connected_at || '',
    updated_at: acc.last_sync_at || ''
  }));
}

/**
 * Busca apps atribuídos a um estudante
 */
export async function getStudentApps(studentId: string): Promise<StudentApp[]> {
  const { data, error } = await supabase
    .from('student_apps')
    .select('id, apps_extensions(id, name, color)')
    .eq('student_id', studentId);

  if (error) {
    throw error;
  }

  return (data || []).map((sa: any) => ({
    student_app_id: sa.id,
    ...(sa.apps_extensions || {})
  })).filter(Boolean);
}

/**
 * Busca jornadas de um estudante
 */
export async function getStudentJourneys(studentId: string): Promise<StudentJourney[]> {
  const { data, error } = await supabase
    .from('student_journeys')
    .select('id, current_phase, overall_progress, student_id')
    .eq('student_id', studentId);

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Busca templates de jornadas disponíveis
 */
export async function getJourneyTemplates(): Promise<JourneyTemplate[]> {
  const { data, error } = await supabase
    .from('journey_templates')
    .select('id, name, is_default')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Busca apps disponíveis
 */
export async function getAvailableApps(): Promise<any[]> {
  const { data, error } = await supabase
    .from('apps_extensions')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error loading available apps:', error);
    throw error;
  }

  // Filtra por is_active se a coluna existir
  const filteredData = data?.filter(app => {
    // Se is_active existe, usa; se não, considera ativo
    return app.is_active === undefined || app.is_active === true;
  }) || [];

  return filteredData;
}

/**
 * Busca entregas de bônus de um estudante
 */
export async function getStudentBonusDeliveries(studentId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('student_bonus_delivery')
    .select(`
      id,
      bonus_id,
      delivered,
      delivered_at,
      delivered_by,
      notes,
      bonus:bonus_id (
        name,
        description,
        cost
      ),
      deliveredByProfile:profiles!delivered_by (
        full_name
      )
    `)
    .eq('student_id', studentId)
    .order('delivered_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Busca métricas consolidadas de múltiplas contas
 */
export async function getConsolidatedAccountMetrics(
  accountIds: string[],
  studentId: string
): Promise<{
  total_sales: number;
  total_revenue: number;
  average_ticket: number;
} | null> {
  if (!accountIds || accountIds.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from('mercado_livre_metrics')
    .select('*')
    .eq('student_id', studentId)
    .in('ml_account_id', accountIds);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const consolidated = data.reduce((acc, m) => ({
    total_sales: acc.total_sales + (m.total_sales || 0),
    total_revenue: acc.total_revenue + (m.total_revenue || 0),
    average_ticket: 0,
  }), { total_sales: 0, total_revenue: 0, average_ticket: 0 });

  consolidated.average_ticket = consolidated.total_sales > 0 
    ? consolidated.total_revenue / consolidated.total_sales 
    : 0;

  return consolidated;
}

/**
 * Busca apps atribuídos a um estudante (para próprio aluno visualizar)
 */
export async function getMyStudentApps(): Promise<any[]> {
  const { data: userData } = await supabase.auth.getUser();
  
  if (!userData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from('student_apps')
    .select(`
      id,
      app_id,
      created_at,
      apps_extensions!student_apps_app_id_fkey (
        id,
        name,
        description,
        url,
        price,
        tag
      )
    `)
    .eq('student_id', userData.user.id);

  if (error) {
    console.error('Error loading my apps:', error);
    throw error;
  }

  return data || [];
}

/**
 * Adiciona um app para o próprio estudante
 */
export async function addAppToMyProfile(appId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  
  if (!userData.user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabase
    .from('student_apps')
    .insert({
      student_id: userData.user.id,
      app_id: appId
    });

  if (error) {
    throw error;
  }
}

/**
 * Remove um app do próprio estudante
 */
export async function removeAppFromMyProfile(studentAppId: string): Promise<void> {
  const { error } = await supabase
    .from('student_apps')
    .delete()
    .eq('id', studentAppId);

  if (error) {
    throw error;
  }
}

