-- Update bruno.oberhuber@gmail.com to administrator role
UPDATE public.user_roles
SET role = 'administrator'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'bruno.oberhuber@gmail.com'
);