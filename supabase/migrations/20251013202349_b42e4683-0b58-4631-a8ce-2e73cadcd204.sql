-- Criar tabela para métricas de estoque FULL
CREATE TABLE IF NOT EXISTS public.mercado_livre_full_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ml_account_id UUID NOT NULL REFERENCES public.mercado_livre_accounts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  inventory_id TEXT NOT NULL,
  ml_item_id TEXT NOT NULL,
  
  -- Estoque
  available_units INTEGER DEFAULT 0,
  reserved_units INTEGER DEFAULT 0,
  inbound_units INTEGER DEFAULT 0,
  damaged_units INTEGER DEFAULT 0,
  lost_units INTEGER DEFAULT 0,
  
  -- Status
  stock_status TEXT, -- 'low_quality', 'good_quality', 'out_of_stock'
  
  -- Timestamps
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(ml_account_id, inventory_id)
);

-- Adicionar colunas de qualidade de fotos na tabela de produtos
ALTER TABLE public.mercado_livre_products 
ADD COLUMN IF NOT EXISTS has_low_quality_photos BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS min_photo_dimension INTEGER,
ADD COLUMN IF NOT EXISTS photo_count INTEGER DEFAULT 0;

-- RLS para mercado_livre_full_stock
ALTER TABLE public.mercado_livre_full_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own FULL stock"
  ON public.mercado_livre_full_stock
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Managers can view all FULL stock"
  ON public.mercado_livre_full_stock
  FOR SELECT
  USING (has_role(auth.uid(), 'manager'));

-- Trigger para updated_at
CREATE TRIGGER update_ml_full_stock_updated_at
  BEFORE UPDATE ON public.mercado_livre_full_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ml_updated_at();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ml_full_stock_account ON public.mercado_livre_full_stock(ml_account_id);
CREATE INDEX IF NOT EXISTS idx_ml_full_stock_student ON public.mercado_livre_full_stock(student_id);
CREATE INDEX IF NOT EXISTS idx_ml_products_low_quality_photos ON public.mercado_livre_products(has_low_quality_photos) WHERE has_low_quality_photos = true;