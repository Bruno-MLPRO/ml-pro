-- Criar tabelas para integração Mercado Livre

-- Tabela de contas ML conectadas (suporta múltiplas contas por aluno)
CREATE TABLE IF NOT EXISTS public.mercado_livre_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ml_user_id TEXT NOT NULL,
  ml_nickname TEXT NOT NULL,
  access_token TEXT NOT NULL, -- Será criptografado na aplicação
  refresh_token TEXT NOT NULL, -- Será criptografado na aplicação
  token_expires_at TIMESTAMPTZ NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, ml_user_id)
);

CREATE INDEX idx_ml_accounts_student ON public.mercado_livre_accounts(student_id);
CREATE INDEX idx_ml_accounts_ml_user ON public.mercado_livre_accounts(ml_user_id);

-- Tabela de webhooks configurados
CREATE TABLE IF NOT EXISTS public.mercado_livre_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_account_id UUID NOT NULL REFERENCES public.mercado_livre_accounts(id) ON DELETE CASCADE,
  webhook_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ml_account_id, topic)
);

CREATE INDEX idx_ml_webhooks_account ON public.mercado_livre_webhooks(ml_account_id);

-- Tabela de métricas consolidadas
CREATE TABLE IF NOT EXISTS public.mercado_livre_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_account_id UUID NOT NULL REFERENCES public.mercado_livre_accounts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Métricas de vendas (últimos 30 dias)
  total_sales INTEGER DEFAULT 0,
  total_revenue NUMERIC(10,2) DEFAULT 0,
  average_ticket NUMERIC(10,2) DEFAULT 0,
  
  -- Produtos
  active_listings INTEGER DEFAULT 0,
  paused_listings INTEGER DEFAULT 0,
  total_listings INTEGER DEFAULT 0,
  
  -- Reputação
  reputation_level TEXT,
  reputation_score NUMERIC(3,2),
  reputation_transactions_total INTEGER DEFAULT 0,
  
  -- Status de programas
  has_decola BOOLEAN DEFAULT false,
  has_full BOOLEAN DEFAULT false,
  is_mercado_lider BOOLEAN DEFAULT false,
  mercado_lider_level TEXT,
  
  -- Metadados
  period_start DATE,
  period_end DATE,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(ml_account_id)
);

CREATE INDEX idx_ml_metrics_student ON public.mercado_livre_metrics(student_id);
CREATE INDEX idx_ml_metrics_account ON public.mercado_livre_metrics(ml_account_id);

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS public.mercado_livre_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_account_id UUID NOT NULL REFERENCES public.mercado_livre_accounts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  ml_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  price NUMERIC(10,2),
  available_quantity INTEGER DEFAULT 0,
  sold_quantity INTEGER DEFAULT 0,
  status TEXT,
  permalink TEXT,
  thumbnail TEXT,
  listing_type TEXT,
  shipping_mode TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(ml_account_id, ml_item_id)
);

CREATE INDEX idx_ml_products_student ON public.mercado_livre_products(student_id);
CREATE INDEX idx_ml_products_account ON public.mercado_livre_products(ml_account_id);
CREATE INDEX idx_ml_products_item ON public.mercado_livre_products(ml_item_id);
CREATE INDEX idx_ml_products_status ON public.mercado_livre_products(status);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS public.mercado_livre_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_account_id UUID NOT NULL REFERENCES public.mercado_livre_accounts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  ml_order_id TEXT NOT NULL,
  status TEXT,
  date_created TIMESTAMPTZ,
  date_closed TIMESTAMPTZ,
  total_amount NUMERIC(10,2),
  paid_amount NUMERIC(10,2),
  buyer_nickname TEXT,
  shipping_mode TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(ml_account_id, ml_order_id)
);

CREATE INDEX idx_ml_orders_student ON public.mercado_livre_orders(student_id);
CREATE INDEX idx_ml_orders_account ON public.mercado_livre_orders(ml_account_id);
CREATE INDEX idx_ml_orders_order_id ON public.mercado_livre_orders(ml_order_id);
CREATE INDEX idx_ml_orders_date_created ON public.mercado_livre_orders(date_created);
CREATE INDEX idx_ml_orders_status ON public.mercado_livre_orders(status);

-- Tabela de logs de webhooks
CREATE TABLE IF NOT EXISTS public.mercado_livre_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES public.mercado_livre_webhooks(id) ON DELETE SET NULL,
  topic TEXT,
  resource TEXT,
  user_id TEXT,
  application_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ml_webhook_logs_webhook ON public.mercado_livre_webhook_logs(webhook_id);
CREATE INDEX idx_ml_webhook_logs_processed ON public.mercado_livre_webhook_logs(processed);
CREATE INDEX idx_ml_webhook_logs_created ON public.mercado_livre_webhook_logs(created_at);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_ml_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ml_accounts_updated_at
  BEFORE UPDATE ON public.mercado_livre_accounts
  FOR EACH ROW EXECUTE FUNCTION update_ml_updated_at();

CREATE TRIGGER trigger_ml_metrics_updated_at
  BEFORE UPDATE ON public.mercado_livre_metrics
  FOR EACH ROW EXECUTE FUNCTION update_ml_updated_at();

CREATE TRIGGER trigger_ml_products_updated_at
  BEFORE UPDATE ON public.mercado_livre_products
  FOR EACH ROW EXECUTE FUNCTION update_ml_updated_at();

CREATE TRIGGER trigger_ml_orders_updated_at
  BEFORE UPDATE ON public.mercado_livre_orders
  FOR EACH ROW EXECUTE FUNCTION update_ml_updated_at();

-- RLS Policies

-- mercado_livre_accounts
ALTER TABLE public.mercado_livre_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own ML accounts"
  ON public.mercado_livre_accounts FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert own ML accounts"
  ON public.mercado_livre_accounts FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own ML accounts"
  ON public.mercado_livre_accounts FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can delete own ML accounts"
  ON public.mercado_livre_accounts FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Managers can view all ML accounts"
  ON public.mercado_livre_accounts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- mercado_livre_webhooks
ALTER TABLE public.mercado_livre_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own webhooks"
  ON public.mercado_livre_webhooks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mercado_livre_accounts
      WHERE id = ml_account_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view all webhooks"
  ON public.mercado_livre_webhooks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- mercado_livre_metrics
ALTER TABLE public.mercado_livre_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own ML metrics"
  ON public.mercado_livre_metrics FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Managers can view all ML metrics"
  ON public.mercado_livre_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- mercado_livre_products
ALTER TABLE public.mercado_livre_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own ML products"
  ON public.mercado_livre_products FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Managers can view all ML products"
  ON public.mercado_livre_products FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- mercado_livre_orders
ALTER TABLE public.mercado_livre_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own ML orders"
  ON public.mercado_livre_orders FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Managers can view all ML orders"
  ON public.mercado_livre_orders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- mercado_livre_webhook_logs
ALTER TABLE public.mercado_livre_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view all webhook logs"
  ON public.mercado_livre_webhook_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mercado_livre_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mercado_livre_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mercado_livre_accounts;