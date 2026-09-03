alter table public.profiles
  add column if not exists organization text not null default '',
  add column if not exists job_title text not null default '',
  add column if not exists phone text not null default '';

alter table public.profiles
  drop constraint if exists profiles_organization_length,
  add constraint profiles_organization_length check (char_length(organization) <= 120),
  drop constraint if exists profiles_job_title_length,
  add constraint profiles_job_title_length check (char_length(job_title) <= 120),
  drop constraint if exists profiles_phone_length,
  add constraint profiles_phone_length check (char_length(phone) <= 40);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, organization, job_title)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'organization', ''),
    coalesce(new.raw_user_meta_data ->> 'job_title', '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

grant update (full_name, organization, job_title, phone) on public.profiles to authenticated;

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workspace_members'
  ) then
    alter publication supabase_realtime add table public.workspace_members;
  end if;
end;
$$;
