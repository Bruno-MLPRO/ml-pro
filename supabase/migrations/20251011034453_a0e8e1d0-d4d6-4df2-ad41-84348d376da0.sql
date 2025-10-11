-- Add student and manager specific fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS turma text,
ADD COLUMN IF NOT EXISTS estrutura_vendedor text CHECK (estrutura_vendedor IN ('CPF', 'PJ')),
ADD COLUMN IF NOT EXISTS tipo_pj text CHECK (tipo_pj IN ('MEI', 'ME')),
ADD COLUMN IF NOT EXISTS possui_contador boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS caixa numeric(10, 2),
ADD COLUMN IF NOT EXISTS hub_logistico text CHECK (hub_logistico IN ('Pretendo usar', 'Já uso', 'Não vou usar')),
ADD COLUMN IF NOT EXISTS sistemas_externos text,
ADD COLUMN IF NOT EXISTS mentoria_status text CHECK (mentoria_status IN ('Ativo', 'Inativo')) DEFAULT 'Ativo';