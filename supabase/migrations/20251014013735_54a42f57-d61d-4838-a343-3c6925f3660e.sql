-- Add plan_id to profiles table if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id);

-- Create student_bonus_delivery table
CREATE TABLE IF NOT EXISTS public.student_bonus_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bonus_id uuid NOT NULL REFERENCES public.bonus(id) ON DELETE CASCADE,
  delivered boolean DEFAULT false,
  delivered_at timestamp with time zone,
  delivered_by uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(student_id, bonus_id)
);

-- Enable RLS
ALTER TABLE public.student_bonus_delivery ENABLE ROW LEVEL SECURITY;

-- RLS Policies for student_bonus_delivery
CREATE POLICY "Managers can view all bonus deliveries"
  ON public.student_bonus_delivery
  FOR SELECT
  USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Students can view own bonus deliveries"
  ON public.student_bonus_delivery
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Managers can insert bonus deliveries"
  ON public.student_bonus_delivery
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update bonus deliveries"
  ON public.student_bonus_delivery
  FOR UPDATE
  USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can delete bonus deliveries"
  ON public.student_bonus_delivery
  FOR DELETE
  USING (has_role(auth.uid(), 'manager'));

-- Function to auto-populate bonus deliveries when a student is assigned a plan
CREATE OR REPLACE FUNCTION public.sync_student_bonus_on_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If plan_id changed and is not null
  IF NEW.plan_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.plan_id IS DISTINCT FROM NEW.plan_id) THEN
    -- Delete old bonus deliveries if plan changed
    IF TG_OP = 'UPDATE' AND OLD.plan_id IS NOT NULL THEN
      DELETE FROM public.student_bonus_delivery 
      WHERE student_id = NEW.id;
    END IF;
    
    -- Insert new bonus deliveries based on the plan
    INSERT INTO public.student_bonus_delivery (student_id, bonus_id)
    SELECT NEW.id, pb.bonus_id
    FROM public.plan_bonus pb
    WHERE pb.plan_id = NEW.plan_id
    ON CONFLICT (student_id, bonus_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for auto-populating bonus deliveries
DROP TRIGGER IF EXISTS trigger_sync_student_bonus ON public.profiles;
CREATE TRIGGER trigger_sync_student_bonus
  AFTER INSERT OR UPDATE OF plan_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_student_bonus_on_plan_change();

-- Update trigger for student_bonus_delivery
CREATE TRIGGER update_student_bonus_delivery_updated_at
  BEFORE UPDATE ON public.student_bonus_delivery
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Populate existing students with bonus deliveries based on their current plan
INSERT INTO public.student_bonus_delivery (student_id, bonus_id)
SELECT p.id, pb.bonus_id
FROM public.profiles p
JOIN public.plan_bonus pb ON pb.plan_id = p.plan_id
WHERE p.plan_id IS NOT NULL
ON CONFLICT (student_id, bonus_id) DO NOTHING;