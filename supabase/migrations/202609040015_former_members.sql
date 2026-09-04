-- Managers can identify former members; ordinary members see the active team.
create or replace function public.can_view_profile(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_user_id = (select auth.uid()) or (public.has_completed_password_setup() and exists (
    select 1 from public.workspace_members mine join public.workspace_members theirs using (workspace_id)
    where mine.user_id = (select auth.uid()) and mine.active
      and theirs.user_id = target_user_id
      and (theirs.active or mine.role in ('owner', 'super_admin'))));
$$;
drop policy workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members for select to authenticated
using ((select public.is_workspace_member(workspace_id))
  and (active or (select public.is_workspace_manager(workspace_id))));

create function public.can_delete_former_member(target_workspace_id bigint, target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_completed_password_setup() and target_user_id <> (select auth.uid())
    and exists (select 1 from public.workspace_members
      where workspace_id = target_workspace_id and user_id = (select auth.uid())
        and active and role in ('owner', 'super_admin') and can_clear_logs)
    and exists (select 1 from public.workspace_members
      where workspace_id = target_workspace_id and user_id = target_user_id
        and not active and role = 'admin')
    and not exists (select 1 from public.workspace_members
      where user_id = target_user_id and workspace_id <> target_workspace_id);
$$;
revoke all on function public.can_delete_former_member(bigint, uuid) from public, anon;
grant execute on function public.can_delete_former_member(bigint, uuid) to authenticated;

-- Account deletion must not delete shared content or attribute it to somebody
-- else. Null authors/owners are rendered as Former member / Unassigned.
do $$
declare ref record;
begin
  for ref in select * from (values
    ('folders','created_by'), ('documents','owner_id'), ('documents','created_by'),
    ('document_versions','uploaded_by'), ('events','created_by'), ('meetings','created_by'),
    ('tasks','assignee_id'), ('tasks','created_by'), ('quick_links','created_by')
  ) as refs(table_name, column_name)
  loop
    execute format('alter table public.%I alter column %I drop not null', ref.table_name, ref.column_name);
    execute format('alter table public.%I drop constraint %I', ref.table_name, ref.table_name || '_' || ref.column_name || '_fkey');
    execute format('alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null',
      ref.table_name, ref.table_name || '_' || ref.column_name || '_fkey', ref.column_name);
  end loop;
end;
$$;

alter table public.chat_messages alter column sender_id drop not null;
alter table public.chat_messages drop constraint chat_messages_sender_id_fkey;
alter table public.chat_messages add constraint chat_messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete set null;
alter table public.chat_messages drop constraint chat_messages_workspace_id_sender_id_fkey;
alter table public.chat_messages add constraint chat_messages_workspace_id_sender_id_fkey
  foreign key (workspace_id, sender_id) references public.workspace_members(workspace_id, user_id) on delete set null (sender_id);
alter table public.chat_read_states drop constraint chat_read_states_workspace_id_user_id_fkey;
alter table public.chat_read_states add constraint chat_read_states_workspace_id_user_id_fkey
  foreign key (workspace_id, user_id) references public.workspace_members(workspace_id, user_id) on delete cascade;
notify pgrst, 'reload schema';
