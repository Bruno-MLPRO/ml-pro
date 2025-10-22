-- Create table for storing Mercado Livre seller recovery/Decola program data
CREATE TABLE IF NOT EXISTS public.mercado_livre_seller_recovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_account_id UUID NOT NULL REFERENCES public.mercado_livre_accounts(id) ON DELETE CASCADE,
  
  -- Program identification
  program_type TEXT, -- 'NEWBIE_GRNTEE' or 'RECOVERY_GRNTEE'
  status TEXT, -- 'AVAILABLE', 'ACTIVE', 'UNAVAILABLE', 'FINISHED_*'
  current_level TEXT, -- level_id atual ('newbie', '1_red', '2_orange', '3_yellow')
  site_id TEXT, -- 'MLA', 'MLB', 'MLM', 'MLC', 'MCO'
  
  -- Protection limits
  max_issues_allowed INTEGER, -- maximum problems allowed
  protection_days_limit INTEGER, -- protection duration in days
  
  -- Guarantees
  guarantee_price NUMERIC, -- guarantee value
  advertising_amount NUMERIC, -- ML Ads bonus value
  guarantee_status TEXT, -- 'ON' or 'OFF'
  
  -- Current protection details
  is_renewal BOOLEAN, -- if protection was reactivated
  warning TEXT, -- alert about finalization
  init_date TIMESTAMP WITH TIME ZONE, -- protection start
  end_date TIMESTAMP WITH TIME ZONE, -- protection end
  protection_days INTEGER, -- valid days
  start_level TEXT, -- initial color
  end_level TEXT, -- final color
  
  -- Sales during protection
  orders_qty INTEGER, -- quantity of orders
  total_issues INTEGER, -- total problems
  claims_qty INTEGER, -- claims
  cancel_qty INTEGER, -- cancellations
  delay_qty INTEGER, -- delays
  
  -- Timestamps
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(ml_account_id)
);

-- Add columns to mercado_livre_metrics
ALTER TABLE public.mercado_livre_metrics
ADD COLUMN IF NOT EXISTS has_recovery_benefit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recovery_program_type TEXT,
ADD COLUMN IF NOT EXISTS recovery_program_status TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_seller_recovery_ml_account ON public.mercado_livre_seller_recovery(ml_account_id);
CREATE INDEX IF NOT EXISTS idx_seller_recovery_status ON public.mercado_livre_seller_recovery(status);

-- Enable RLS
ALTER TABLE public.mercado_livre_seller_recovery ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mercado_livre_seller_recovery
CREATE POLICY "Users can view their own seller recovery data"
ON public.mercado_livre_seller_recovery
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.mercado_livre_accounts
    WHERE mercado_livre_accounts.id = mercado_livre_seller_recovery.ml_account_id
    AND mercado_livre_accounts.student_id = auth.uid()
  )
);

CREATE POLICY "Managers can view all seller recovery data"
ON public.mercado_livre_seller_recovery
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'manager'
  )
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_seller_recovery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_seller_recovery_updated_at_trigger
BEFORE UPDATE ON public.mercado_livre_seller_recovery
FOR EACH ROW
EXECUTE FUNCTION update_seller_recovery_updated_at();