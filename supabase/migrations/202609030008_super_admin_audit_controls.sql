alter table public.workspace_members
  drop constraint if exists workspace_members_role_check,
  add constraint workspace_members_role_check check (role in ('owner', 'super_admin', 'admin'));

create or replace function public.is_workspace_auditor(target_workspace_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and role in ('owner', 'super_admin')
      and active = true
  );
$$;

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
for select to authenticated
using ((select public.is_workspace_auditor(workspace_id)));

create index if not exists audit_log_workspace_kind_idx
  on public.audit_log (workspace_id, entity_kind);

create or replace function public.clear_workspace_log(
  target_workspace_id bigint,
  target_scope text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_workspace_auditor(target_workspace_id) then
    raise exception 'Only an owner or super admin can clear workspace logs';
  end if;
  if target_scope not in ('activity', 'members') then
    raise exception 'Invalid log scope';
  end if;

  if target_scope = 'members' then
    delete from public.audit_log
    where workspace_id = target_workspace_id
      and entity_kind = 'member';
  else
    delete from public.audit_log
    where workspace_id = target_workspace_id
      and entity_kind <> 'member';
  end if;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.is_workspace_auditor(bigint) from public;
revoke all on function public.clear_workspace_log(bigint, text) from public;
grant execute on function public.is_workspace_auditor(bigint) to authenticated;
grant execute on function public.clear_workspace_log(bigint, text) to authenticated;

notify pgrst, 'reload schema';
