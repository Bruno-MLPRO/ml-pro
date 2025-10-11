-- Create journey_templates table to store different journey types
CREATE TABLE IF NOT EXISTS public.journey_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create milestone_templates table (master templates for each journey type)
CREATE TABLE IF NOT EXISTS public.milestone_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_template_id UUID NOT NULL REFERENCES public.journey_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  phase TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.journey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journey_templates
CREATE POLICY "Managers can view all journey templates"
ON public.journey_templates
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage journey templates"
ON public.journey_templates
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for milestone_templates
CREATE POLICY "Managers can view all milestone templates"
ON public.milestone_templates
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage milestone templates"
ON public.milestone_templates
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Insert default journey templates
INSERT INTO public.journey_templates (name, description, is_default) VALUES
('Principal', 'Jornada principal que todos os alunos têm por padrão', true),
('Gestão Financeira', 'Aprenda a gerenciar as finanças do seu negócio', false),
('Gestão de Estoque', 'Controle e otimize seu estoque', false),
('Centralize HUB', 'Centralize suas operações em um único hub', false),
('Importação Simplificada', 'Simplifique seus processos de importação', false),
('Rankear Produto', 'Estratégias para rankear seus produtos', false);

-- Add triggers for updated_at
CREATE TRIGGER update_journey_templates_updated_at
BEFORE UPDATE ON public.journey_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_milestone_templates_updated_at
BEFORE UPDATE ON public.milestone_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();