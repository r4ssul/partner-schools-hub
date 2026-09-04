-- An invitation verifies email and issues an Auth session before a password
-- exists. A session alone must not grant access to workspace data.
create or replace function public.has_completed_password_setup()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users
    where id = (select auth.uid()) and coalesce(encrypted_password, '') <> ''
      and email_confirmed_at is not null and deleted_at is null
      and (banned_until is null or banned_until <= now()));
$$;
revoke all on function public.has_completed_password_setup() from public, anon;
grant execute on function public.has_completed_password_setup() to authenticated;

create or replace function public.is_workspace_member(target_workspace_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_completed_password_setup() and exists (
    select 1 from public.workspace_members where workspace_id = target_workspace_id
      and user_id = (select auth.uid()) and active);
$$;

create or replace function public.is_workspace_manager(target_workspace_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_completed_password_setup() and exists (
    select 1 from public.workspace_members where workspace_id = target_workspace_id
      and user_id = (select auth.uid()) and active and role in ('owner', 'super_admin'));
$$;

create or replace function public.is_workspace_owner(target_workspace_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_completed_password_setup() and exists (
    select 1 from public.workspace_members where workspace_id = target_workspace_id
      and user_id = (select auth.uid()) and active and role = 'owner');
$$;

create or replace function public.is_workspace_auditor(target_workspace_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_workspace_manager(target_workspace_id);
$$;

create or replace function public.can_view_profile(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_user_id = (select auth.uid()) or (public.has_completed_password_setup() and exists (
    select 1 from public.workspace_members mine join public.workspace_members theirs using (workspace_id)
    where mine.user_id = (select auth.uid()) and mine.active
      and theirs.user_id = target_user_id and theirs.active));
$$;

create or replace function public.clear_workspace_log(target_workspace_id bigint, target_scope text)
returns integer language plpgsql security definer set search_path = '' as $$
declare deleted_count integer;
begin
  if not public.has_completed_password_setup() or not exists (select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = (select auth.uid())
      and active and role in ('owner', 'super_admin') and can_clear_logs) then
    raise exception 'Log-clearing permission required';
  end if;
  if target_scope is null or target_scope not in ('activity', 'members') then raise exception 'Invalid log scope'; end if;
  delete from public.audit_log where workspace_id = target_workspace_id
    and case when target_scope = 'members' then entity_kind = 'member' else entity_kind <> 'member' end;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Also cover policies previously scoped only to the user's own identity.
create policy notifications_setup_required on public.notifications as restrictive for all to authenticated
using ((select public.has_completed_password_setup())) with check ((select public.has_completed_password_setup()));
create policy notification_preferences_setup_required on public.notification_preferences as restrictive for all to authenticated
using ((select public.has_completed_password_setup())) with check ((select public.has_completed_password_setup()));
notify pgrst, 'reload schema';
