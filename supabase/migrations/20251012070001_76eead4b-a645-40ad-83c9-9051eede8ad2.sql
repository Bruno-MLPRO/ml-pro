-- Add DELETE policy for managers on profiles table
CREATE POLICY "Managers can delete student profiles"
  ON public.profiles
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = profiles.id
      AND user_roles.role = 'student'::app_role
    )
  );

-- Add DELETE policy for managers on user_roles table
CREATE POLICY "Managers can delete student roles"
  ON public.user_roles
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    AND role = 'student'::app_role
  );

-- Add DELETE policy for managers on student_journeys table
CREATE POLICY "Managers can delete student journeys"
  ON public.student_journeys
  FOR DELETE
  USING (public.has_role(auth.uid(), 'manager'::app_role));