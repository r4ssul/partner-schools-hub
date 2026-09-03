-- Create the item and its relations in one transaction. RLS still applies.
create function public.create_workspace_item(target_workspace_id bigint, item jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  kind text := item->>'kind';
  title text := btrim(item->>'title');
  description text := coalesce(item->>'description', '');
  parent bigint := nullif(item->>'parentId', '')::bigint;
  assignee uuid := coalesce(nullif(item->>'assigneeId', '')::uuid, actor);
  meeting_id bigint := nullif(item->>'sourceMeetingId', '')::bigint;
  event_id bigint := nullif(item->>'sourceEventId', '')::bigint;
  doc_ids bigint[] := array(select distinct value::bigint from jsonb_array_elements_text(coalesce(item->'documentIds', '[]'::jsonb)));
  attendees uuid[] := array(select distinct value::uuid from jsonb_array_elements_text(coalesce(item->'attendeeIds', '[]'::jsonb)));
  result bigint;
begin
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Active workspace membership required'; end if;
  if title is null or char_length(title) not between 2 and 120 then raise exception 'Enter a title between 2 and 120 characters'; end if;
  if char_length(description) > 2000 then raise exception 'Description is too long'; end if;
  if exists (select 1 from unnest(doc_ids) d where not exists (
    select 1 from public.documents where id = d and workspace_id = target_workspace_id and deleted_at is null
  )) then raise exception 'A linked file is no longer available'; end if;
  if exists (select 1 from unnest(attendees) a where not exists (
    select 1 from public.workspace_members where user_id = a and workspace_id = target_workspace_id and active
  )) then raise exception 'An attendee is no longer active'; end if;
  if parent is not null and not exists (select 1 from public.folders where id = parent and workspace_id = target_workspace_id and deleted_at is null)
    then raise exception 'Destination folder is no longer available'; end if;
  if meeting_id is not null and not exists (select 1 from public.meetings where id = meeting_id and workspace_id = target_workspace_id and deleted_at is null)
    then raise exception 'Linked meeting is no longer available'; end if;
  if event_id is not null and not exists (select 1 from public.events where id = event_id and workspace_id = target_workspace_id and deleted_at is null)
    then raise exception 'Linked event is no longer available'; end if;
  if kind = 'folder' then
    perform pg_advisory_xact_lock(target_workspace_id);
    if exists (select 1 from public.folders where workspace_id = target_workspace_id and parent_id is not distinct from parent and lower(name) = lower(title) and deleted_at is null)
      then raise exception 'A folder with this name already exists here'; end if;
    insert into public.folders(workspace_id, name, parent_id, created_by) values (target_workspace_id, title, parent, actor) returning id into result;
  elsif kind = 'event' then
    insert into public.events(workspace_id, title, description, starts_at, ends_at, location, document_ids, created_by)
      values (target_workspace_id, title, description, (item->>'startDate')::timestamptz, (item->>'endDate')::timestamptz, coalesce(item->>'location',''), doc_ids, actor) returning id into result;
    insert into public.event_attendees(event_id, user_id, workspace_id) select result, a, target_workspace_id from unnest(attendees) a;
  elsif kind = 'meeting' then
    insert into public.meetings(workspace_id, title, agenda, starts_at, ends_at, location, document_ids, created_by)
      values (target_workspace_id, title, description, (item->>'startDate')::timestamptz, (item->>'endDate')::timestamptz, coalesce(item->>'location',''), doc_ids, actor) returning id into result;
    insert into public.meeting_attendees(meeting_id, user_id, workspace_id) select result, a, target_workspace_id from unnest(attendees) a;
  elsif kind = 'task' then
    if not exists (select 1 from public.workspace_members where workspace_id = target_workspace_id and user_id = assignee and active)
      then raise exception 'Assignee is no longer active'; end if;
    insert into public.tasks(workspace_id, title, notes, assignee_id, due_at, priority, source_meeting_id, source_event_id, created_by)
      values (target_workspace_id, title, description, assignee, (item->>'dueDate')::timestamptz, coalesce(item->>'priority','medium'), meeting_id, event_id, actor) returning id into result;
    insert into public.task_documents(task_id, document_id, workspace_id) select result, d, target_workspace_id from unnest(doc_ids) d;
  elsif kind = 'link' then
    insert into public.quick_links(workspace_id, title, description, url, category, created_by)
      values (target_workspace_id, title, description, item->>'url', coalesce(nullif(item->>'category',''),'General'), actor) returning id into result;
  else raise exception 'Unsupported item type';
  end if;
  return result;
end;
$$;
revoke all on function public.create_workspace_item(bigint, jsonb) from public, anon;
grant execute on function public.create_workspace_item(bigint, jsonb) to authenticated;
notify pgrst, 'reload schema';
