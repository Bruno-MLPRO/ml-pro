-- Fix the tipo_pj constraint to allow NULL values
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_tipo_pj_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_tipo_pj_check 
CHECK (tipo_pj IS NULL OR tipo_pj IN ('MEI', 'ME'));