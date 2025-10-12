-- Add policy for students to view journey templates
CREATE POLICY "Students can view journey templates"
ON public.journey_templates
FOR SELECT
USING (has_role(auth.uid(), 'student'::app_role));

-- Add policy for students to view milestone templates
CREATE POLICY "Students can view milestone templates"
ON public.milestone_templates
FOR SELECT
USING (has_role(auth.uid(), 'student'::app_role));