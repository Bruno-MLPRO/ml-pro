-- Update RLS policies to include 'administrator' role
-- This migration fixes data visibility for administrators

-- journey_templates policies
DROP POLICY IF EXISTS "Managers can manage journey templates" ON public.journey_templates;
DROP POLICY IF EXISTS "Managers can view all journey templates" ON public.journey_templates;

CREATE POLICY "Managers and administrators can manage journey templates" 
ON public.journey_templates 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can view all journey templates" 
ON public.journey_templates 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- milestone_templates policies
DROP POLICY IF EXISTS "Managers can manage milestone templates" ON public.milestone_templates;
DROP POLICY IF EXISTS "Managers can view all milestone templates" ON public.milestone_templates;

CREATE POLICY "Managers and administrators can manage milestone templates" 
ON public.milestone_templates 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can view all milestone templates" 
ON public.milestone_templates 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- plans policies
DROP POLICY IF EXISTS "Managers can delete plans" ON public.plans;
DROP POLICY IF EXISTS "Managers can insert plans" ON public.plans;
DROP POLICY IF EXISTS "Managers can update plans" ON public.plans;
DROP POLICY IF EXISTS "Managers can view all plans" ON public.plans;

CREATE POLICY "Managers and administrators can delete plans" 
ON public.plans 
FOR DELETE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can insert plans" 
ON public.plans 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can update plans" 
ON public.plans 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can view all plans" 
ON public.plans 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- bonus policies
DROP POLICY IF EXISTS "Managers can delete bonus" ON public.bonus;
DROP POLICY IF EXISTS "Managers can insert bonus" ON public.bonus;
DROP POLICY IF EXISTS "Managers can update bonus" ON public.bonus;
DROP POLICY IF EXISTS "Managers can view all bonus" ON public.bonus;

CREATE POLICY "Managers and administrators can delete bonus" 
ON public.bonus 
FOR DELETE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can insert bonus" 
ON public.bonus 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can update bonus" 
ON public.bonus 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can view all bonus" 
ON public.bonus 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- apps_extensions policies
DROP POLICY IF EXISTS "Managers can delete apps" ON public.apps_extensions;
DROP POLICY IF EXISTS "Managers can insert apps" ON public.apps_extensions;
DROP POLICY IF EXISTS "Managers can update apps" ON public.apps_extensions;
DROP POLICY IF EXISTS "Managers can view all apps" ON public.apps_extensions;

CREATE POLICY "Managers and administrators can delete apps" 
ON public.apps_extensions 
FOR DELETE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can insert apps" 
ON public.apps_extensions 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can update apps" 
ON public.apps_extensions 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can view all apps" 
ON public.apps_extensions 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- plan_bonus policies
DROP POLICY IF EXISTS "Managers can delete plan_bonus" ON public.plan_bonus;
DROP POLICY IF EXISTS "Managers can insert plan_bonus" ON public.plan_bonus;
DROP POLICY IF EXISTS "Managers can view all plan_bonus" ON public.plan_bonus;

CREATE POLICY "Managers and administrators can delete plan_bonus" 
ON public.plan_bonus 
FOR DELETE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can insert plan_bonus" 
ON public.plan_bonus 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can view all plan_bonus" 
ON public.plan_bonus 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- profiles policies
DROP POLICY IF EXISTS "Managers can update student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can delete student profiles" ON public.profiles;

CREATE POLICY "Managers and administrators can update student profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = profiles.id 
    AND user_roles.role = 'student'::app_role
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = profiles.id 
    AND user_roles.role = 'student'::app_role
  )
);

CREATE POLICY "Managers and administrators can delete student profiles" 
ON public.profiles 
FOR DELETE 
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = profiles.id 
    AND user_roles.role = 'student'::app_role
  )
);

-- student_journeys policies
DROP POLICY IF EXISTS "Managers can delete student journeys" ON public.student_journeys;
DROP POLICY IF EXISTS "Managers can insert journeys" ON public.student_journeys;
DROP POLICY IF EXISTS "Managers can update journeys" ON public.student_journeys;
DROP POLICY IF EXISTS "Managers can view all journeys" ON public.student_journeys;

CREATE POLICY "Managers and administrators can delete student journeys" 
ON public.student_journeys 
FOR DELETE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can insert journeys" 
ON public.student_journeys 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can update journeys" 
ON public.student_journeys 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can view all journeys" 
ON public.student_journeys 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- user_roles policies
DROP POLICY IF EXISTS "Managers can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Managers can delete student roles" ON public.user_roles;

CREATE POLICY "Managers and administrators can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can delete student roles" 
ON public.user_roles 
FOR DELETE 
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
  AND role = 'student'::app_role
);

-- call_schedules policies
DROP POLICY IF EXISTS "Managers can manage call schedules" ON public.call_schedules;

CREATE POLICY "Managers and administrators can manage call schedules" 
ON public.call_schedules 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- important_links policies
DROP POLICY IF EXISTS "Managers can manage important links" ON public.important_links;

CREATE POLICY "Managers and administrators can manage important links" 
ON public.important_links 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- notices policies
DROP POLICY IF EXISTS "Managers can manage notices" ON public.notices;

CREATE POLICY "Managers and administrators can manage notices" 
ON public.notices 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- student_bonus_delivery policies
DROP POLICY IF EXISTS "Managers can delete bonus deliveries" ON public.student_bonus_delivery;
DROP POLICY IF EXISTS "Managers can insert bonus deliveries" ON public.student_bonus_delivery;
DROP POLICY IF EXISTS "Managers can update bonus deliveries" ON public.student_bonus_delivery;
DROP POLICY IF EXISTS "Managers can view all bonus deliveries" ON public.student_bonus_delivery;

CREATE POLICY "Managers and administrators can delete bonus deliveries" 
ON public.student_bonus_delivery 
FOR DELETE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can insert bonus deliveries" 
ON public.student_bonus_delivery 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can update bonus deliveries" 
ON public.student_bonus_delivery 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can view all bonus deliveries" 
ON public.student_bonus_delivery 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- student_apps policies
DROP POLICY IF EXISTS "Managers can delete student apps" ON public.student_apps;
DROP POLICY IF EXISTS "Managers can insert student apps" ON public.student_apps;
DROP POLICY IF EXISTS "Managers can view all student apps" ON public.student_apps;

CREATE POLICY "Managers and administrators can delete student apps" 
ON public.student_apps 
FOR DELETE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can insert student apps" 
ON public.student_apps 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can view all student apps" 
ON public.student_apps 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- milestones policies
DROP POLICY IF EXISTS "Managers can manage milestones" ON public.milestones;
DROP POLICY IF EXISTS "Managers can view all milestones" ON public.milestones;

CREATE POLICY "Managers and administrators can manage milestones" 
ON public.milestones 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE POLICY "Managers and administrators can view all milestones" 
ON public.milestones 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));