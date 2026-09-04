-- Supabase's invite verification generates a temporary password BEFORE email
-- confirmation. A nonempty Auth password alone does not prove user setup.
create table public.account_activation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_set_at timestamptz not null default now()
);
alter table public.account_activation enable row level security;
revoke all on table public.account_activation from public, anon, authenticated;

-- Preserve existing users only when a trusted password login proves they know
-- their password, or their confirmed account was provisioned without an invite.
insert into public.account_activation(user_id)
select u.id from auth.users u
where coalesce(u.encrypted_password, '') <> '' and u.email_confirmed_at is not null
  and (u.invited_at is null or exists (
    select 1 from auth.sessions s join auth.mfa_amr_claims a on a.session_id = s.id
    where s.user_id = u.id and a.authentication_method = 'password'));

create function public.record_verified_password_setup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.account_activation(user_id, password_set_at)
  values (new.id, now())
  on conflict (user_id) do update set password_set_at = excluded.password_set_at;
  return new;
end;
$$;
revoke all on function public.record_verified_password_setup() from public, anon, authenticated;

-- Auth owns encrypted_password and email_confirmed_at. Browser metadata,
-- profile writes, and invitation verification cannot create this record.
create trigger on_verified_password_saved
after update of encrypted_password on auth.users
for each row when (
  old.email_confirmed_at is not null
  and new.email_confirmed_at is not null
  and coalesce(new.encrypted_password, '') <> ''
  and new.encrypted_password is distinct from old.encrypted_password
)
execute function public.record_verified_password_setup();

create or replace function public.has_completed_password_setup()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u join public.account_activation a on a.user_id = u.id
    where u.id = (select auth.uid()) and coalesce(u.encrypted_password, '') <> ''
      and u.email_confirmed_at is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now()));
$$;
notify pgrst, 'reload schema';
