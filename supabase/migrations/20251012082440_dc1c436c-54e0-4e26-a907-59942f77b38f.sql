-- Create apps_extensions table
CREATE TABLE public.apps_extensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  description TEXT,
  price NUMERIC,
  tag TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.apps_extensions ENABLE ROW LEVEL SECURITY;

-- Managers can view all apps
CREATE POLICY "Managers can view all apps" 
ON public.apps_extensions 
FOR SELECT 
USING (public.has_role(auth.uid(), 'manager'::app_role));

-- Managers can insert apps
CREATE POLICY "Managers can insert apps" 
ON public.apps_extensions 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

-- Managers can update apps
CREATE POLICY "Managers can update apps" 
ON public.apps_extensions 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'manager'::app_role));

-- Managers can delete apps
CREATE POLICY "Managers can delete apps" 
ON public.apps_extensions 
FOR DELETE 
USING (public.has_role(auth.uid(), 'manager'::app_role));

-- Create student_apps junction table
CREATE TABLE public.student_apps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  app_id UUID NOT NULL REFERENCES public.apps_extensions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(student_id, app_id)
);

-- Enable RLS on student_apps
ALTER TABLE public.student_apps ENABLE ROW LEVEL SECURITY;

-- Managers can view all student apps
CREATE POLICY "Managers can view all student apps" 
ON public.student_apps 
FOR SELECT 
USING (public.has_role(auth.uid(), 'manager'::app_role));

-- Managers can insert student apps
CREATE POLICY "Managers can insert student apps" 
ON public.student_apps 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

-- Managers can delete student apps
CREATE POLICY "Managers can delete student apps" 
ON public.student_apps 
FOR DELETE 
USING (public.has_role(auth.uid(), 'manager'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_apps_extensions_updated_at
BEFORE UPDATE ON public.apps_extensions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();