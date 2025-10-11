-- Update handle_new_user function to also create student_journeys entry for students
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.email
  );
  
  -- Get role from metadata and insert into user_roles
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student')::app_role;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  -- If user is a student, create student_journey entry
  IF user_role = 'student' THEN
    INSERT INTO public.student_journeys (student_id)
    VALUES (NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;