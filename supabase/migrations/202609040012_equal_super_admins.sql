-- Management role and log-clearing capability are independent. Both named
-- leaders are Super Admins; only Rassul receives the additional capability.
alter table public.workspace_members add column can_clear_logs boolean not null default false;
alter table public.workspace_members add constraint log_clear_requires_manager
  check (not can_clear_logs or role in ('owner', 'super_admin'));

-- Retain the historical function/trigger name for compatibility, but protect
-- the last active manager, not an obsolete Owner-only role.
create or replace function public.protect_final_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role in ('owner', 'super_admin') and old.active
    and (tg_op = 'DELETE' or new.role not in ('owner', 'super_admin') or not new.active) then
    perform id from public.workspaces where id = old.workspace_id for update;
    if not exists (select 1 from public.workspace_members
      where workspace_id = old.workspace_id and user_id <> old.user_id
        and role in ('owner', 'super_admin') and active) then
      raise exception 'The final active Super Admin cannot be removed or demoted';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.clear_workspace_log(target_workspace_id bigint, target_scope text)
returns integer language plpgsql security definer set search_path = '' as $$
declare deleted_count integer;
begin
  if not exists (select 1 from public.workspace_members
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
revoke all on function public.clear_workspace_log(bigint, text) from public, anon;
grant execute on function public.clear_workspace_log(bigint, text) to authenticated;

do $$
declare w bigint; rassul_id uuid; jan_id uuid; m record; next_role text; may_clear boolean;
begin
  select id into rassul_id from public.profiles where lower(email) = 'rassul.abzhapparov@enishi.ac.jp';
  select id into jan_id from public.profiles where lower(email) = 'mcanbaloglu@enishi.ac.jp';
  for w in select a.workspace_id from public.workspace_members a join public.workspace_members b using (workspace_id)
    where a.user_id = rassul_id and b.user_id = jan_id and a.active and b.active
  loop
    for m in select * from public.workspace_members where workspace_id = w
      order by (user_id in (rassul_id, jan_id)) desc
    loop
      next_role := case when m.user_id in (rassul_id, jan_id) then 'super_admin' else 'admin' end;
      may_clear := m.user_id = rassul_id;
      if m.role <> next_role or m.can_clear_logs <> may_clear then
        update public.workspace_members set role = next_role, can_clear_logs = may_clear
          where workspace_id = w and user_id = m.user_id;
        insert into public.audit_log (workspace_id, actor_id, action, entity_kind, entity_id, entity_name, metadata)
          select w, rassul_id, 'updated permissions', 'member', m.user_id::text, full_name,
            jsonb_build_object('from_role', m.role, 'role', next_role, 'can_clear_logs', may_clear)
          from public.profiles where id = m.user_id;
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.bootstrap_workspace(workspace_name text default 'Partner Schools Hub')
returns bigint language plpgsql security definer set search_path = '' as $$
declare new_workspace_id bigint; current_user_id uuid := (select auth.uid()); current_user_email text;
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
  insert into public.workspace_members (workspace_id, user_id, role, can_clear_logs)
    values (new_workspace_id, current_user_id, 'super_admin', true);
  insert into public.notification_preferences (workspace_id, user_id) values (new_workspace_id, current_user_id);
  insert into public.folders (workspace_id, name, created_by)
    select new_workspace_id, folder_name, current_user_id
    from unnest(array['Early Years','PYP','MYP','DP','Safeguarding','Marketing & Admissions','Student Support','IT / AI','Meeting Minutes']) as folder_name;
  return new_workspace_id;
end;
$$;
revoke all on function public.bootstrap_workspace(text) from public, anon;
grant execute on function public.bootstrap_workspace(text) to authenticated;
notify pgrst, 'reload schema';
