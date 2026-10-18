drop policy if exists "Profiles are viewable by admins" on public.profiles;
drop policy if exists "Students can view their own profile" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;

create policy "Users can read their own profile" on public.profiles
for select using (auth.uid() = id);