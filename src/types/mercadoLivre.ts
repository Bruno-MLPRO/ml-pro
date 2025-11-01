// Tipos relacionados ao Mercado Livre

export interface MLAccount {
  id: string;
  ml_nickname: string;
  ml_user_id: number;
  is_primary: boolean;
  is_active: boolean;
  connected_at: string;
  last_sync_at: string | null;
  metrics?: MLMetrics | null;
}

export interface MLMetrics {
  id: string;
  ml_account_id: string;
  total_sales: number;
  total_revenue: number;
  average_ticket: number;
  active_listings: number;
  reputation_level: string | null;
  reputation_score: number;
  reputation_color: string;
  reputation_transactions_total: number;
  positive_ratings_rate: number;
  has_decola: boolean;
  has_full: boolean;
  is_mercado_lider: boolean;
  mercado_lider_level: string | null;
  last_updated: string;
}

export interface MLProduct {
  id: string;
  ml_account_id: string;
  ml_item_id: string;
  title: string;
  price: number;
  available_quantity: number;
  sold_quantity: number;
  status: 'active' | 'paused' | 'closed';
  permalink: string;
  thumbnail: string;
  shipping_mode: string; // Mantido para compatibilidade
  logistic_type: string | null; // Mantido para compatibilidade
  shipping_modes?: string[] | null; // ✅ Array com todos os modos disponíveis (ex: ["me2", "custom"])
  logistic_types?: string[] | null; // ✅ Array com todos os tipos ME2 disponíveis (ex: ["self_service", "xd_drop_off"])
  listing_type_id: string;
  category_id: string;
  condition: string;
  has_pictures: boolean;
  has_description: boolean;
  has_tax_data: boolean;
  full_eligible: boolean;
  created_at: string;
  updated_at: string;
  health?: ProductHealth;
}

export interface ProductHealth {
  health_score: number;
  health_level: 'excellent' | 'good' | 'needs_attention' | 'critical';
  goals: HealthGoal[];
  goals_completed: number;
  goals_applicable: number;
  score_trend?: 'up' | 'down' | 'stable';
  previous_score?: number;
}

export interface HealthGoal {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  impact: 'high' | 'medium' | 'low';
  action_url?: string;
}

export interface MLOrder {
  id: string;
  ml_account_id: string;
  ml_order_id: number;
  status: string;
  status_detail: string;
  date_created: string;
  date_closed: string | null;
  total_amount: number;
  paid_amount: number;
  shipping_type: string;
  buyer_id: number;
  items: any;
  student_id?: string;
}

export interface MLFullStock {
  id: string;
  ml_account_id: string;
  ml_item_id: string;
  inventory_id: string;
  available_units: number;
  reserved_units: number;
  inbound_units: number;
  damaged_units: number;
  lost_units: number;
  stock_status: string;
  synced_at: string;
  mercado_livre_products?: {
    title: string;
    thumbnail: string;
    permalink: string;
    price: number;
  };
}

export interface MLCampaign {
  id: string;
  ml_account_id: string;
  campaign_id: string;
  advertiser_id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget: number;
  total_budget: number;
  start_date: string;
  end_date: string | null;
  impressions: number;
  clicks: number;
  total_spend: number;
  ad_revenue: number;
  advertised_sales: number;
  synced_at: string;
}

export interface HealthHistory {
  date: string;
  averageScore: number;
}

// Tipos específicos usados em MLAccountDashboard
export interface MLSellerRecovery {
  id: string;
  ml_account_id: string;
  program_type: 'NEWBIE_GRNTEE' | 'RECOVERY_GRNTEE';
  status: string;
  current_level: string;
  site_id: string;
  max_issues_allowed: number;
  protection_days_limit: number;
  guarantee_price: number | null;
  advertising_amount: number | null;
  guarantee_status: string | null;
  is_renewal: boolean;
  warning: string | null;
  init_date: string | null;
  end_date: string | null;
  protection_days: number | null;
  start_level: string | null;
  end_level: string | null;
  orders_qty: number;
  total_issues: number;
  claims_qty: number;
  cancel_qty: number;
  delay_qty: number;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
}

// ItemHealth com HealthGoal específico para MLAccountDashboard
export interface ItemHealth {
  health_score: number;
  health_level: string;
  goals: HealthGoal[];
  goals_completed: number;
  goals_applicable: number;
}

// Campaign usado em MLAccountDashboard (extensão de MLCampaign)
export interface Campaign extends MLCampaign {
  strategy?: string;
  budget?: number;
  acos_target?: number;
  organic_revenue?: number;
  organic_sales?: number;
  total_revenue?: number;
  total_sales?: number;
}

// ProductAd usado em MLAccountDashboard
export interface ProductAd {
  id: string;
  ml_product_id: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  daily_budget: number;
  total_budget: number;
  impressions: number;
  clicks: number;
  spend: number;
  revenue: number;
  roas: number;
  acos: number;
  cpc: number;
  ctr: number;
  conversion_rate: number;
  orders: number;
}

// AdsMetrics usado em StudentDetails (versão local específica)
export interface AdsMetrics {
  totalSpend: number;
  totalRevenue: number;
  totalAcos: number;
  totalRoas: number;
  totalProductsInAds: number;
  activeCampaigns: number;
}

