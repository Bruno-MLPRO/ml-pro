-- Add CPF and CNPJ fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS cnpj text;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.cpf IS 'CPF pessoal do usuário';
COMMENT ON COLUMN public.profiles.cnpj IS 'Número do CNPJ (quando aplicável)';