-- Create bonus table
CREATE TABLE public.bonus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cost NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create plan_bonus junction table (many-to-many relationship)
CREATE TABLE public.plan_bonus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  bonus_id UUID NOT NULL REFERENCES public.bonus(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(plan_id, bonus_id)
);

-- Enable RLS on bonus table
ALTER TABLE public.bonus ENABLE ROW LEVEL SECURITY;

-- Enable RLS on plan_bonus table
ALTER TABLE public.plan_bonus ENABLE ROW LEVEL SECURITY;

-- Policies for bonus table
CREATE POLICY "Managers can view all bonus"
ON public.bonus
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can insert bonus"
ON public.bonus
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can update bonus"
ON public.bonus
FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can delete bonus"
ON public.bonus
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));

-- Policies for plan_bonus table
CREATE POLICY "Managers can view all plan_bonus"
ON public.plan_bonus
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can insert plan_bonus"
ON public.plan_bonus
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can delete plan_bonus"
ON public.plan_bonus
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role));

-- Trigger to update updated_at on bonus
CREATE TRIGGER update_bonus_updated_at
BEFORE UPDATE ON public.bonus
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();