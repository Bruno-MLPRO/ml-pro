-- Update handle_new_user function to create default student journey with milestones
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
  journey_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.email
  );
  
  -- Get role from metadata and insert into user_roles
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student')::app_role;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  -- If user is a student, create student_journey entry with milestones
  IF user_role = 'student' THEN
    INSERT INTO public.student_journeys (student_id, current_phase)
    VALUES (NEW.id, 'Onboarding')
    RETURNING id INTO journey_id;
    
    -- Create Onboarding milestones
    INSERT INTO public.milestones (journey_id, phase, title, description, order_index, status) VALUES
    (journey_id, 'Onboarding', 'Call Inicial com Gestor', 'Realizar reunião inicial de onboarding com o gestor', 1, 'not_started'),
    (journey_id, 'Onboarding', 'Assistir todas as aulas da área de membros', 'Completar todo o conteúdo educacional da plataforma', 2, 'not_started');
    
    -- Create Estrutura Inicial milestones
    INSERT INTO public.milestones (journey_id, phase, title, description, order_index, status) VALUES
    (journey_id, 'Estrutura Inicial', 'Criar conta Mercado Livre', 'Criar e configurar conta no Mercado Livre', 3, 'not_started'),
    (journey_id, 'Estrutura Inicial', 'Ativar Decola', 'Ativar programa Decola no Mercado Livre', 4, 'not_started'),
    (journey_id, 'Estrutura Inicial', '10 Vendas concluídas', 'Completar as primeiras 10 vendas na plataforma', 5, 'not_started'),
    (journey_id, 'Estrutura Inicial', 'Flex ativado', 'Ativar modalidade Flex de envio', 6, 'not_started'),
    (journey_id, 'Estrutura Inicial', 'Catálogo Liberado', 'Liberar catálogo completo de produtos', 7, 'not_started'),
    (journey_id, 'Estrutura Inicial', 'Validação de Experiência', 'Aprovação do gestor para avançar de fase', 8, 'not_started');
    
    -- Create Profissionalização milestones
    INSERT INTO public.milestones (journey_id, phase, title, description, order_index, status) VALUES
    (journey_id, 'Profissionalização', 'Criar CNPJ (MEI ou ME)', 'Formalizar empresa como MEI ou Microempresa', 9, 'not_started'),
    (journey_id, 'Profissionalização', 'Análise e Contato com Fornecedores', 'Estabelecer relacionamento com fornecedores', 10, 'not_started'),
    (journey_id, 'Profissionalização', 'Certificado Digital A1 emitido', 'Emitir certificado digital para notas fiscais', 11, 'not_started'),
    (journey_id, 'Profissionalização', 'Emissor de NF do Mercado Livre configurado', 'Configurar emissor de notas fiscais no ML', 12, 'not_started'),
    (journey_id, 'Profissionalização', 'FULL Liberado', 'Liberar modalidade FULL no Mercado Livre', 13, 'not_started'),
    (journey_id, 'Profissionalização', '1° Envio para o FULL', 'Realizar primeiro envio usando FULL', 14, 'not_started');
  END IF;
  
  RETURN NEW;
END;
$$;