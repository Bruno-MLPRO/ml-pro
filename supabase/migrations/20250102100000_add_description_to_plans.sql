-- Add description column to plans table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='plans' AND column_name='description'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add other missing columns that should exist
DO $$ 
BEGIN
  -- duration_months
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='plans' AND column_name='duration_months'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN duration_months INTEGER DEFAULT 1;
  END IF;
  
  -- is_active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='plans' AND column_name='is_active'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  -- features (JSONB)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='plans' AND column_name='features'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN features JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.plans.description IS 'Descrição detalhada do plano';
COMMENT ON COLUMN public.plans.duration_months IS 'Duração do plano em meses';
COMMENT ON COLUMN public.plans.is_active IS 'Se o plano está ativo e disponível para assinatura';
COMMENT ON COLUMN public.plans.features IS 'Lista de features do plano em formato JSON';

