-- Events are workspace-wide. Meetings are private to their creator and named
-- attendees, and both appear together in the calendar for people allowed to
-- see them. Assignment alerts are inserted transactionally with the content.

create or replace function public.is_meeting_attendee(target_meeting_id bigint, target_workspace_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_workspace_member(target_workspace_id) and exists (
    select 1 from public.meeting_attendees
    where meeting_id = target_meeting_id
      and workspace_id = target_workspace_id
      and user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_meeting_attendee(bigint, bigint) from public, anon;
grant execute on function public.is_meeting_attendee(bigint, bigint) to authenticated;

drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings for select to authenticated
using ((select public.is_meeting_attendee(id, workspace_id)));

drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings for update to authenticated
using ((select public.is_meeting_attendee(id, workspace_id)))
with check ((select public.is_meeting_attendee(id, workspace_id)));

drop policy if exists meeting_attendees_select on public.meeting_attendees;
create policy meeting_attendees_select on public.meeting_attendees for select to authenticated
using ((select public.is_meeting_attendee(meeting_id, workspace_id)));

create or replace function public.ensure_meeting_creator_attends()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.meeting_attendees(meeting_id, user_id, workspace_id)
    values (new.id, new.created_by, new.workspace_id)
    on conflict (meeting_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists meetings_ensure_creator_attends on public.meetings;
create trigger meetings_ensure_creator_attends after insert on public.meetings
for each row execute function public.ensure_meeting_creator_attends();

insert into public.meeting_attendees(meeting_id, user_id, workspace_id)
select id, created_by, workspace_id from public.meetings where created_by is not null
on conflict (meeting_id, user_id) do nothing;

create or replace function public.notification_html_escape(value text)
returns text language sql immutable strict set search_path = '' as $$
  select replace(replace(replace(replace(replace(value,
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;
revoke all on function public.notification_html_escape(text) from public, anon, authenticated;

create or replace function public.queue_assignment_notification(
  target_workspace_id bigint,
  target_user_id uuid,
  target_kind text,
  target_id bigint,
  target_title text,
  target_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  recipient_email text;
  workspace_name text;
  notification_title text;
  notification_body text;
  email_subject text;
  email_body text;
  dedupe_key text;
begin
  if target_user_id is null or target_kind not in ('event', 'meeting', 'task') then return; end if;
  if not exists (select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = target_user_id and active) then return; end if;

  select email into recipient_email from public.profiles where id = target_user_id;
  select name into workspace_name from public.workspaces where id = target_workspace_id;
  dedupe_key := target_kind || '-assigned:' || target_id || ':' || target_user_id;
  notification_title := case target_kind
    when 'event' then 'Added to event'
    when 'meeting' then 'Meeting invitation'
    else 'Task assigned'
  end;
  notification_body := target_title || case when target_at is null then '' else
    ' · ' || to_char(target_at at time zone 'Asia/Tokyo', 'Mon FMDD, YYYY FMHH12:MI AM') end;
  email_subject := notification_title || ': ' || target_title;
  email_body := '<p>You have a new ' || target_kind || ' in <strong>' ||
    public.notification_html_escape(coalesce(workspace_name, 'Partner Schools Hub')) || '</strong>.</p>' ||
    '<p><strong>' || public.notification_html_escape(target_title) || '</strong>' ||
    case when target_at is null then '' else '<br>' || public.notification_html_escape(
      to_char(target_at at time zone 'Asia/Tokyo', 'FMMonth FMDD, YYYY at FMHH12:MI AM') || ' (Asia/Tokyo)') end || '</p>';

  insert into public.notifications(workspace_id, user_id, title, body, event_key)
  values (target_workspace_id, target_user_id, notification_title, notification_body, dedupe_key)
  on conflict (user_id, event_key) do nothing;

  if recipient_email is not null and coalesce((select email_enabled from public.notification_preferences
    where workspace_id = target_workspace_id and user_id = target_user_id), true) then
    insert into public.notification_outbox(workspace_id, user_id, recipient_email, subject, body_html, event_key)
    values (target_workspace_id, target_user_id, recipient_email, email_subject, email_body, dedupe_key)
    on conflict (event_key) do nothing;
  end if;
end;
$$;
revoke all on function public.queue_assignment_notification(bigint, uuid, text, bigint, text, timestamptz) from public, anon, authenticated;

create or replace function public.notify_event_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare item record;
begin
  select title, starts_at into item from public.events
  where id = new.event_id and workspace_id = new.workspace_id and deleted_at is null;
  if found then perform public.queue_assignment_notification(new.workspace_id, new.user_id, 'event', new.event_id, item.title, item.starts_at); end if;
  return new;
end;
$$;

create or replace function public.notify_meeting_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare item record;
begin
  select title, starts_at into item from public.meetings
  where id = new.meeting_id and workspace_id = new.workspace_id and deleted_at is null;
  if found then perform public.queue_assignment_notification(new.workspace_id, new.user_id, 'meeting', new.meeting_id, item.title, item.starts_at); end if;
  return new;
end;
$$;

drop trigger if exists event_attendees_notify_assignment on public.event_attendees;
create trigger event_attendees_notify_assignment after insert on public.event_attendees
for each row execute function public.notify_event_assignment();
drop trigger if exists meeting_attendees_notify_assignment on public.meeting_attendees;
create trigger meeting_attendees_notify_assignment after insert on public.meeting_attendees
for each row execute function public.notify_meeting_assignment();

create or replace function public.notify_task_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_id is null or (tg_op = 'UPDATE' and old.assignee_id is not distinct from new.assignee_id) then return new; end if;
  perform public.queue_assignment_notification(new.workspace_id, new.assignee_id, 'task', new.id, new.title, new.due_at);
  return new;
end;
$$;

-- The Web. Developer can clear either log independently or both together.
create or replace function public.clear_workspace_log(target_workspace_id bigint, target_scope text)
returns integer language plpgsql security definer set search_path = '' as $$
declare deleted_count integer;
begin
  if not exists (select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = (select auth.uid())
      and active and role in ('owner', 'super_admin') and can_clear_logs) then
    raise exception 'Log-clearing permission required';
  end if;
  if target_scope is null or target_scope not in ('activity', 'members', 'all') then raise exception 'Invalid log scope'; end if;
  delete from public.audit_log where workspace_id = target_workspace_id and case
    when target_scope = 'members' then entity_kind = 'member'
    when target_scope = 'activity' then entity_kind <> 'member'
    else true
  end;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function public.clear_workspace_log(bigint, text) from public, anon;
grant execute on function public.clear_workspace_log(bigint, text) to authenticated;

notify pgrst, 'reload schema';
