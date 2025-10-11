-- Add address fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS endereco text,
ADD COLUMN IF NOT EXISTS cidade text,
ADD COLUMN IF NOT EXISTS estado text,
ADD COLUMN IF NOT EXISTS cep text;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.endereco IS 'Endereço completo (rua, número, complemento)';
COMMENT ON COLUMN public.profiles.cidade IS 'Cidade';
COMMENT ON COLUMN public.profiles.estado IS 'Estado (UF)';
COMMENT ON COLUMN public.profiles.cep IS 'CEP';