// ============================================================================
// TIPOS PARA GESTÃO FINANCEIRA
// ============================================================================

// ============================================================================
// 1. PLANOS E ASSINATURAS
// ============================================================================

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_months: number;
  features: any;
  is_active: boolean;
  target_audience: string;
  max_students: number | null;
  current_students: number;
  discount_percentage: number;
  promotion_end_date: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'overdue';
export type PaymentMethod = 'pix' | 'boleto' | 'credit_card' | 'debit_card' | 'cash' | 'bank_transfer' | 'other';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface StudentSubscription {
  id: string;
  student_id: string;
  plan_id: string | null;
  start_date: string;
  end_date: string | null;
  monthly_price: number;
  payment_day: number;
  status: SubscriptionStatus;
  payment_method: PaymentMethod;
  auto_renewal: boolean;
  notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos (quando incluídos)
  plan?: Plan;
  student?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

export interface SubscriptionPayment {
  id: string;
  subscription_id: string;
  due_date: string;
  paid_date: string | null;
  amount: number;
  status: PaymentStatus;
  payment_method: PaymentMethod | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos
  subscription?: StudentSubscription;
}

export interface SubscriptionPaymentWithDetails extends SubscriptionPayment {
  student_name: string;
  student_email: string;
  student_id: string;
  plan_name: string;
  plan_price: number;
}

export interface MarkPaymentPaidDTO {
  payment_id: string;
  paid_date: string;
  payment_method: PaymentMethod;
  transaction_id?: string;
  notes?: string;
}

export interface PaymentStats {
  total_expected: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  payment_success_rate: number;
  avg_days_to_pay: number;
}

// ============================================================================
// 2. FLUXO DE CAIXA
// ============================================================================

export type CashFlowType = 'income' | 'expense';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type CashFlowStatus = 'pending' | 'confirmed' | 'cancelled';
export type RelatedToType = 'student' | 'manager' | 'general' | 'subscription';

export interface CashFlowCategory {
  id: string;
  name: string;
  type: CashFlowType;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CashFlowEntry {
  id: string;
  type: CashFlowType;
  category_id: string | null;
  category_name: string | null;
  title: string;
  description: string | null;
  amount: number;
  date: string;
  is_recurring: boolean;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_interval: number;
  recurrence_end_date: string | null;
  parent_entry_id: string | null;
  related_to_type: RelatedToType | null;
  related_to_id: string | null;
  related_to_name: string | null;
  payment_method: PaymentMethod | null;
  payment_status: CashFlowStatus;
  transaction_id: string | null;
  receipt_url: string | null;
  notes: string | null;
  tags: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos
  category?: CashFlowCategory;
}

// ============================================================================
// 3. SALÁRIOS E COMISSÕES
// ============================================================================

export type SalaryStatus = 'active' | 'inactive';

export interface ManagerSalary {
  id: string;
  manager_id: string;
  base_salary: number;
  commission_percentage: number;
  payment_day: number;
  start_date: string;
  end_date: string | null;
  status: SalaryStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos
  manager?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export type SalaryPaymentStatus = 'pending' | 'paid' | 'cancelled';

export interface SalaryPayment {
  id: string;
  manager_salary_id: string;
  manager_id: string;
  reference_month: string;
  base_salary: number;
  commission_amount: number;
  bonus_amount: number;
  deductions: number;
  total_amount: number;
  total_students_revenue: number;
  due_date: string;
  paid_date: string | null;
  status: SalaryPaymentStatus;
  payment_method: PaymentMethod | null;
  transaction_id: string | null;
  notes: string | null;
  calculation_details: any;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos
  manager_salary?: ManagerSalary;
  manager?: {
    id: string;
    full_name: string;
    email: string;
  };
}

// ============================================================================
// 4. METAS FINANCEIRAS
// ============================================================================

export type GoalType = 'mrr' | 'revenue' | 'students' | 'profit_margin' | 'expense_reduction';
export type GoalStatus = 'active' | 'achieved' | 'failed' | 'cancelled';

export interface FinancialGoal {
  id: string;
  title: string;
  description: string | null;
  goal_type: GoalType;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date: string;
  status: GoalStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 5. MÉTRICAS E DASHBOARDS
// ============================================================================

export interface MRRData {
  month: string;
  active_students: number;
  mrr: number;
  avg_price_per_student: number;
}

export interface MonthlyCashFlowSummary {
  month: string;
  type: CashFlowType;
  total_amount: number;
  transaction_count: number;
}

export interface FinancialMetrics {
  // Receitas
  mrr: number;
  arr: number;
  total_revenue_month: number;
  total_revenue_year: number;
  
  // Despesas
  total_expenses_month: number;
  total_expenses_year: number;
  
  // Lucro
  profit_month: number;
  profit_year: number;
  profit_margin: number;
  
  // Alunos
  active_students: number;
  new_students_month: number;
  churned_students_month: number;
  churn_rate: number;
  
  // Outros
  avg_ticket: number;
  ltv: number;
  cac: number;
  ltv_cac_ratio: number;
  
  // Fluxo de Caixa
  current_balance: number;
  runway_months: number;
}

export interface CashFlowChartData {
  month: string;
  income: number;
  expense: number;
  profit: number;
}

// ============================================================================
// 6. FORMULÁRIOS E INPUTS
// ============================================================================

export interface CreateSubscriptionInput {
  student_id: string;
  plan_id: string | null;
  start_date: string;
  monthly_price: number;
  payment_day: number;
  payment_method: PaymentMethod;
  auto_renewal: boolean;
  notes?: string;
}

export interface UpdateSubscriptionInput {
  monthly_price?: number;
  payment_day?: number;
  status?: SubscriptionStatus;
  payment_method?: PaymentMethod;
  auto_renewal?: boolean;
  notes?: string;
  cancellation_reason?: string;
}

export interface CreateCashFlowEntryInput {
  type: CashFlowType;
  category_id: string | null;
  title: string;
  description?: string;
  amount: number;
  date: string;
  is_recurring?: boolean;
  recurrence_frequency?: RecurrenceFrequency;
  recurrence_interval?: number;
  recurrence_end_date?: string;
  related_to_type?: RelatedToType;
  related_to_id?: string;
  payment_method?: PaymentMethod;
  payment_status?: CashFlowStatus;
  notes?: string;
  tags?: string[];
}

export interface UpdateCashFlowEntryInput {
  type?: CashFlowType;
  category_id?: string | null;
  title?: string;
  description?: string;
  amount?: number;
  date?: string;
  payment_status?: CashFlowStatus;
  notes?: string;
}

export interface CreatePaymentInput {
  subscription_id: string;
  due_date: string;
  amount: number;
  discount_amount?: number;
  payment_method?: PaymentMethod;
  notes?: string;
}

export interface MarkPaymentPaidInput {
  paid_date: string;
  payment_method: PaymentMethod;
  transaction_id?: string;
  payment_proof_url?: string;
}

// ============================================================================
// 7. FILTROS E QUERIES
// ============================================================================

export interface CashFlowFilters {
  type?: CashFlowType;
  category_id?: string;
  date_from?: string;
  date_to?: string;
  payment_status?: CashFlowStatus;
  related_to_type?: RelatedToType;
  search?: string;
}

export interface SubscriptionFilters {
  status?: SubscriptionStatus;
  plan_id?: string;
  payment_method?: PaymentMethod;
  student_search?: string;
}

export interface PaymentFilters {
  status?: PaymentStatus;
  date_from?: string;
  date_to?: string;
  subscription_id?: string;
}

