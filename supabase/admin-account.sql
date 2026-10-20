-- Create the admin user in Supabase Authentication first.
-- Recommended default login:
--   Email: admin@quizim.local
--   Password: Admin@12345
--
-- Then run this script in the Supabase SQL editor to link the auth user to the admin profile.

insert into public.profiles (id, full_name, role)
values (
  '<AUTH_USER_UUID>',
  'Administrator',
  'admin'
)
on conflict (id) do update
set full_name = excluded.full_name,
    role = 'admin';

-- If you want to inspect the current admin rows:
-- select * from public.profiles where role = 'admin';
