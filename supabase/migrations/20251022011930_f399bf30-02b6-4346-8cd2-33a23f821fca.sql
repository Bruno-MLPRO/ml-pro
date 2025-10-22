-- Create table for Mercado Livre Product Ads data
CREATE TABLE IF NOT EXISTS public.mercado_livre_product_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ml_account_id UUID NOT NULL REFERENCES public.mercado_livre_accounts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  ml_item_id TEXT NOT NULL,
  advertiser_id TEXT,
  campaign_id BIGINT,
  title TEXT NOT NULL,
  thumbnail TEXT,
  status TEXT,
  is_recommended BOOLEAN DEFAULT false,
  price NUMERIC,
  
  -- Sales metrics (last 30 days)
  total_sales INTEGER DEFAULT 0,
  advertised_sales INTEGER DEFAULT 0,
  non_advertised_sales INTEGER DEFAULT 0,
  ad_revenue NUMERIC DEFAULT 0,
  non_ad_revenue NUMERIC DEFAULT 0,
  total_spend NUMERIC DEFAULT 0,
  roas NUMERIC,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC,
  acos NUMERIC,
  
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_product_ads_account_item 
ON public.mercado_livre_product_ads(ml_account_id, ml_item_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ml_product_ads_account 
ON public.mercado_livre_product_ads(ml_account_id);

CREATE INDEX IF NOT EXISTS idx_ml_product_ads_student 
ON public.mercado_livre_product_ads(student_id);

CREATE INDEX IF NOT EXISTS idx_ml_product_ads_recommended 
ON public.mercado_livre_product_ads(is_recommended);

-- Enable RLS
ALTER TABLE public.mercado_livre_product_ads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Students can view own product ads data" 
ON public.mercado_livre_product_ads 
FOR SELECT 
USING (student_id = auth.uid());

CREATE POLICY "Managers can view all product ads data" 
ON public.mercado_livre_product_ads 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_ml_product_ads_updated_at
BEFORE UPDATE ON public.mercado_livre_product_ads
FOR EACH ROW
EXECUTE FUNCTION public.update_ml_updated_at();

-- Add advertiser_id column to mercado_livre_accounts table
ALTER TABLE public.mercado_livre_accounts 
ADD COLUMN IF NOT EXISTS advertiser_id TEXT;

ALTER TABLE public.mercado_livre_accounts 
ADD COLUMN IF NOT EXISTS has_product_ads_enabled BOOLEAN DEFAULT false;