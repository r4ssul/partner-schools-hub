-- Leadership has identical management permissions except destructive log clearing.
create or replace function public.is_workspace_manager(target_workspace_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = (select auth.uid())
      and active and role in ('owner', 'super_admin'));
$$;
revoke all on function public.is_workspace_manager(bigint) from public, anon;
grant execute on function public.is_workspace_manager(bigint) to authenticated;

drop policy workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update to authenticated
using ((select public.is_workspace_manager(id))) with check ((select public.is_workspace_manager(id)));

create or replace function public.clear_workspace_log(target_workspace_id bigint, target_scope text)
returns integer language plpgsql security definer set search_path = '' as $$
declare deleted_count integer;
begin
  if not public.is_workspace_owner(target_workspace_id) then raise exception 'Only the Owner can clear workspace logs'; end if;
  if target_scope is null or target_scope not in ('activity', 'members') then raise exception 'Invalid log scope'; end if;
  delete from public.audit_log where workspace_id = target_workspace_id
    and case when target_scope = 'members' then entity_kind = 'member' else entity_kind <> 'member' end;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function public.clear_workspace_log(bigint, text) from public, anon;
grant execute on function public.clear_workspace_log(bigint, text) to authenticated;

-- Only transfer the workspace where BOTH explicitly requested accounts exist.
-- Promote first so the final-owner invariant remains valid throughout.
do $$
declare w bigint; owner_id uuid; super_id uuid; m record; new_role text;
begin
  select id into owner_id from public.profiles where lower(email) = 'rassul.abzhapparov@enishi.ac.jp';
  select id into super_id from public.profiles where lower(email) = 'mcanbaloglu@enishi.ac.jp';
  for w in select a.workspace_id from public.workspace_members a join public.workspace_members b using (workspace_id)
    where a.user_id = owner_id and b.user_id = super_id and a.active and b.active
  loop
    for m in select * from public.workspace_members where workspace_id = w order by (user_id = owner_id) desc
    loop
      new_role := case when m.user_id = owner_id then 'owner' when m.user_id = super_id then 'super_admin' else 'admin' end;
      if m.role <> new_role then
        update public.workspace_members set role = new_role where workspace_id = w and user_id = m.user_id;
        insert into public.audit_log (workspace_id, actor_id, action, entity_kind, entity_id, entity_name, metadata)
        select w, owner_id, 'changed role', 'member', m.user_id::text, full_name, jsonb_build_object('from', m.role, 'to', new_role)
        from public.profiles where id = m.user_id;
      end if;
    end loop;
  end loop;
end;
$$;

create table public.chat_messages (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  client_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, sender_id, client_id),
  foreign key (workspace_id, sender_id) references public.workspace_members(workspace_id, user_id)
);
create index chat_messages_workspace_latest_idx on public.chat_messages(workspace_id, id desc);
create index chat_messages_sender_time_idx on public.chat_messages(sender_id, created_at desc);

create table public.chat_read_states (
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_message_id bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  foreign key (workspace_id, user_id) references public.workspace_members(workspace_id, user_id)
);
create index chat_read_states_user_idx on public.chat_read_states(user_id);
alter table public.chat_messages enable row level security;
alter table public.chat_read_states enable row level security;
revoke all on public.chat_messages, public.chat_read_states from anon, authenticated;
grant select on public.chat_messages, public.chat_read_states to authenticated;
create policy chat_messages_select on public.chat_messages for select to authenticated
using ((select public.is_workspace_member(workspace_id)));
create policy chat_read_states_select on public.chat_read_states for select to authenticated
using (user_id = (select auth.uid()) and (select public.is_workspace_member(workspace_id)));

-- All writes go through RPCs: clients cannot forge a sender or alter history.
create function public.send_chat_message(target_workspace_id bigint, message_body text, request_id uuid)
returns public.chat_messages language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); result public.chat_messages; recent_count integer;
begin
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Active workspace membership required'; end if;
  if message_body is null or char_length(btrim(message_body)) not between 1 and 2000 or request_id is null then
    raise exception 'Messages must contain 1–2000 characters';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 17));
  select * into result from public.chat_messages where workspace_id = target_workspace_id and sender_id = actor and client_id = request_id;
  if found then return result; end if;
  select count(*) into recent_count from public.chat_messages where sender_id = actor and created_at > now() - interval '1 minute';
  if recent_count >= 30 then raise exception 'Please wait a moment before sending more messages'; end if;
  insert into public.chat_messages(workspace_id, sender_id, body, client_id)
    values (target_workspace_id, actor, btrim(message_body), request_id) returning * into result;
  return result;
end;
$$;

create function public.mark_chat_read(target_workspace_id bigint, message_id bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare result bigint;
begin
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Active workspace membership required'; end if;
  if not exists (select 1 from public.chat_messages where workspace_id = target_workspace_id and id = message_id) then
    raise exception 'Message not found in this workspace';
  end if;
  insert into public.chat_read_states(workspace_id, user_id, last_read_message_id)
    values (target_workspace_id, (select auth.uid()), message_id)
    on conflict (workspace_id, user_id) do update set
      last_read_message_id = greatest(chat_read_states.last_read_message_id, excluded.last_read_message_id), updated_at = now()
    returning last_read_message_id into result;
  return result;
end;
$$;
revoke all on function public.send_chat_message(bigint, text, uuid), public.mark_chat_read(bigint, bigint) from public, anon;
grant execute on function public.send_chat_message(bigint, text, uuid), public.mark_chat_read(bigint, bigint) to authenticated;
alter publication supabase_realtime add table public.chat_messages, public.chat_read_states;
notify pgrst, 'reload schema';
