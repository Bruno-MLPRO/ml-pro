-- Allow managers to update student profiles
CREATE POLICY "Managers can update student profiles"
ON public.profiles
FOR UPDATE
TO public
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = profiles.id 
    AND user_roles.role = 'student'::app_role
  )
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = profiles.id 
    AND user_roles.role = 'student'::app_role
  )
);