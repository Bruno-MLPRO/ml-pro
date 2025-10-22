-- Create table for Product Ads campaigns
CREATE TABLE IF NOT EXISTS public.mercado_livre_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_account_id UUID NOT NULL REFERENCES public.mercado_livre_accounts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id BIGINT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT,
  strategy TEXT,
  budget NUMERIC,
  acos_target NUMERIC,
  
  -- Metrics (last 30 days)
  total_spend NUMERIC DEFAULT 0,
  ad_revenue NUMERIC DEFAULT 0,
  organic_revenue NUMERIC DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  
  advertised_sales INTEGER DEFAULT 0,
  organic_sales INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC,
  roas NUMERIC,
  acos NUMERIC,
  
  products_count INTEGER DEFAULT 0,
  
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(ml_account_id, campaign_id)
);

-- Enable RLS
ALTER TABLE public.mercado_livre_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns
CREATE POLICY "Students can view own campaigns"
  ON public.mercado_livre_campaigns
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Managers can view all campaigns"
  ON public.mercado_livre_campaigns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'manager'::app_role
    )
  );

-- Simplify product_ads table - remove metric columns
ALTER TABLE public.mercado_livre_product_ads
  DROP COLUMN IF EXISTS total_sales,
  DROP COLUMN IF EXISTS advertised_sales,
  DROP COLUMN IF EXISTS non_advertised_sales,
  DROP COLUMN IF EXISTS ad_revenue,
  DROP COLUMN IF EXISTS non_ad_revenue,
  DROP COLUMN IF EXISTS total_spend,
  DROP COLUMN IF EXISTS roas,
  DROP COLUMN IF EXISTS impressions,
  DROP COLUMN IF EXISTS clicks,
  DROP COLUMN IF EXISTS ctr,
  DROP COLUMN IF EXISTS acos;

-- Add campaign reference columns
ALTER TABLE public.mercado_livre_product_ads
  ADD COLUMN IF NOT EXISTS campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS ad_group_id BIGINT;

-- Update trigger for campaigns
CREATE TRIGGER update_mercado_livre_campaigns_updated_at
  BEFORE UPDATE ON public.mercado_livre_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ml_updated_at();