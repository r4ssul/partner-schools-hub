create or replace function public.bootstrap_workspace(workspace_name text default 'Partner Schools Hub')
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  new_workspace_id bigint;
  current_user_id uuid := (select auth.uid());
  current_user_email text;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;

  select email into current_user_email from auth.users where id = current_user_id;
  if lower(coalesce(current_user_email, '')) <> 'rassul.abzhapparov@enishi.ac.jp' then
    raise exception 'This account cannot create the initial workspace';
  end if;
  perform pg_advisory_xact_lock(230904);
  if exists (select 1 from public.workspaces) then raise exception 'Workspace is already configured'; end if;
  if exists (select 1 from public.workspace_members where user_id = current_user_id) then
    raise exception 'User already belongs to a workspace';
  end if;

  update public.profiles set full_name = 'Rassul Abzhapparov', updated_at = now() where id = current_user_id;
  insert into public.workspaces (name) values (workspace_name) returning id into new_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (new_workspace_id, current_user_id, 'owner');
  insert into public.notification_preferences (workspace_id, user_id) values (new_workspace_id, current_user_id);
  insert into public.folders (workspace_id, name, created_by)
  select new_workspace_id, folder_name, current_user_id
  from unnest(array['Early Years','PYP','MYP','DP','Safeguarding','Marketing & Admissions','Student Support','IT / AI','Meeting Minutes']) as folder_name;
  return new_workspace_id;
end;
$$;

revoke all on function public.bootstrap_workspace(text) from public;
grant execute on function public.bootstrap_workspace(text) to authenticated;
