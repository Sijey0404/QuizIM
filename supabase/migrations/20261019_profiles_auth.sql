create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

drop policy if exists "Profiles are viewable by admins" on public.profiles;
drop policy if exists "Students can view their own profile" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;

create policy "Users can read their own profile" on public.profiles
for select using (auth.uid() = id or public.is_admin());