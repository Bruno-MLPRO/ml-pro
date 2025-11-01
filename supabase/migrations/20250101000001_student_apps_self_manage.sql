-- Migration: Permitir que alunos gerenciem seus próprios apps/extensões
-- Adiciona policies RLS para alunos visualizarem e gerenciarem seus apps

-- Adiciona coluna is_active se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'apps_extensions' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.apps_extensions 
    ADD COLUMN is_active BOOLEAN DEFAULT true;
    
    -- Atualiza todos os registros existentes
    UPDATE public.apps_extensions SET is_active = true;
  END IF;
END $$;

-- Students podem ver apps/extensões disponíveis
CREATE POLICY "Students can view available apps" 
ON public.apps_extensions 
FOR SELECT 
USING (true); -- Permite ver todos os apps por enquanto, pode ser restringido depois

-- Students podem ver seus próprios apps
CREATE POLICY "Students can view their own apps" 
ON public.student_apps 
FOR SELECT 
USING (student_id = auth.uid());

-- Students podem adicionar apps para si mesmos
CREATE POLICY "Students can insert their own apps" 
ON public.student_apps 
FOR INSERT 
WITH CHECK (student_id = auth.uid());

-- Students podem remover seus próprios apps
CREATE POLICY "Students can delete their own apps" 
ON public.student_apps 
FOR DELETE 
USING (student_id = auth.uid());

-- Comentários
COMMENT ON POLICY "Students can view available apps" ON public.apps_extensions IS 
'Permite que alunos visualizem a lista de apps e extensões disponíveis';

COMMENT ON POLICY "Students can view their own apps" ON public.student_apps IS 
'Permite que alunos visualizem seus próprios apps atribuídos';

COMMENT ON POLICY "Students can insert their own apps" ON public.student_apps IS 
'Permite que alunos selecionem apps para usar';

COMMENT ON POLICY "Students can delete their own apps" ON public.student_apps IS 
'Permite que alunos removam apps que não usam mais';

