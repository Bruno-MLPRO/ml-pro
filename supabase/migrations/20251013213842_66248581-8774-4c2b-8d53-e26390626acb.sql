-- Add new columns to mercado_livre_products table
ALTER TABLE public.mercado_livre_products 
ADD COLUMN IF NOT EXISTS logistic_type TEXT,
ADD COLUMN IF NOT EXISTS has_description BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_tax_data BOOLEAN DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_mercado_livre_products_logistic_type 
ON public.mercado_livre_products(logistic_type);

CREATE INDEX IF NOT EXISTS idx_mercado_livre_products_has_description 
ON public.mercado_livre_products(has_description);

CREATE INDEX IF NOT EXISTS idx_mercado_livre_products_has_tax_data 
ON public.mercado_livre_products(has_tax_data);

-- Add comment for documentation
COMMENT ON COLUMN public.mercado_livre_products.logistic_type IS 'Type of logistics used (drop_off, xd_drop_off, etc) - used to detect Decola';
COMMENT ON COLUMN public.mercado_livre_products.has_description IS 'Whether the product has a description filled (>50 chars)';
COMMENT ON COLUMN public.mercado_livre_products.has_tax_data IS 'Whether the product has fiscal data configured (NCM, origin, etc)';