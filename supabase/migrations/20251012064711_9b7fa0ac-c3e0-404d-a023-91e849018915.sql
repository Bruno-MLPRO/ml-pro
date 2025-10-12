-- Create plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Only managers can manage plans
CREATE POLICY "Managers can view all plans"
  ON public.plans
  FOR SELECT
  USING (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can insert plans"
  ON public.plans
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can update plans"
  ON public.plans
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can delete plans"
  ON public.plans
  FOR DELETE
  USING (public.has_role(auth.uid(), 'manager'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();