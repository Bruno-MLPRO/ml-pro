-- Create tables for student dashboard

-- Avisos (Notices)
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Planejamento de Calls (Call Schedule)
CREATE TABLE IF NOT EXISTS public.call_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  theme TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Links Importantes (Important Links)
CREATE TABLE IF NOT EXISTS public.important_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.important_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notices
CREATE POLICY "Everyone can view active notices"
  ON public.notices FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Managers can manage notices"
  ON public.notices FOR ALL
  USING (has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for call_schedules
CREATE POLICY "Everyone can view call schedules"
  ON public.call_schedules FOR SELECT
  USING (true);

CREATE POLICY "Managers can manage call schedules"
  ON public.call_schedules FOR ALL
  USING (has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for important_links
CREATE POLICY "Everyone can view important links"
  ON public.important_links FOR SELECT
  USING (true);

CREATE POLICY "Managers can manage important links"
  ON public.important_links FOR ALL
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Add comments
COMMENT ON TABLE public.notices IS 'Avisos e notificações para os alunos';
COMMENT ON TABLE public.call_schedules IS 'Planejamento de temas e datas para calls de segunda-feira';
COMMENT ON TABLE public.important_links IS 'Links importantes para os alunos';