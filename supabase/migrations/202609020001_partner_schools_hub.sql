create extension if not exists pgcrypto with schema extensions;

create table public.workspaces (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 120),
  timezone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  avatar_color text not null default '#0b6b6d',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.folders (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  parent_id bigint references public.folders(id) on delete restrict,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_vector tsvector generated always as (to_tsvector('english', coalesce(name, ''))) stored
);

create table public.documents (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  folder_id bigint not null references public.folders(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 240),
  owner_id uuid not null references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_vector tsvector generated always as (to_tsvector('english', coalesce(name, ''))) stored
);

create table public.document_versions (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  document_id bigint not null references public.documents(id) on delete cascade,
  version_number bigint not null check (version_number > 0),
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes between 0 and 52428800),
  mime_type text not null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create table public.events (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '',
  document_ids bigint[] not null default '{}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_vector tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(location, ''))) stored,
  check (ends_at > starts_at)
);

create table public.event_attendees (
  event_id bigint not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  primary key (event_id, user_id)
);

create table public.meetings (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  agenda text not null default '',
  minutes text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '',
  document_ids bigint[] not null default '{}',
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'complete')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_vector tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(agenda, '') || ' ' || coalesce(minutes, '') || ' ' || coalesce(location, ''))) stored,
  check (ends_at > starts_at)
);

create table public.meeting_attendees (
  meeting_id bigint not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  primary key (meeting_id, user_id)
);

create table public.tasks (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  assignee_id uuid not null references auth.users(id),
  due_at timestamptz not null,
  status text not null default 'to_do' check (status in ('to_do', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  notes text not null default '',
  source_meeting_id bigint references public.meetings(id) on delete set null,
  source_event_id bigint references public.events(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_vector tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(notes, ''))) stored
);

create table public.task_documents (
  task_id bigint not null references public.tasks(id) on delete cascade,
  document_id bigint not null references public.documents(id) on delete cascade,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  primary key (task_id, document_id)
);

create table public.quick_links (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  url text not null check (url ~ '^https?://'),
  description text not null default '',
  category text not null default 'General',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_vector tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))) stored
);

create table public.notifications (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  event_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, event_key)
);

create table public.notification_preferences (
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  body_html text not null,
  event_key text not null unique,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_kind text not null,
  entity_id text not null,
  entity_name text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index folders_workspace_parent_active_idx on public.folders (workspace_id, parent_id, name) where deleted_at is null;
create index folders_parent_id_idx on public.folders (parent_id);
create index documents_workspace_folder_active_idx on public.documents (workspace_id, folder_id, updated_at desc) where deleted_at is null;
create index documents_owner_id_idx on public.documents (owner_id);
create index document_versions_document_id_idx on public.document_versions (document_id, version_number desc);
create index events_workspace_starts_active_idx on public.events (workspace_id, starts_at, id) where deleted_at is null;
create index event_attendees_user_id_idx on public.event_attendees (user_id);
create index event_attendees_workspace_id_idx on public.event_attendees (workspace_id);
create index meetings_workspace_starts_active_idx on public.meetings (workspace_id, starts_at, id) where deleted_at is null;
create index meeting_attendees_user_id_idx on public.meeting_attendees (user_id);
create index meeting_attendees_workspace_id_idx on public.meeting_attendees (workspace_id);
create index tasks_workspace_status_due_active_idx on public.tasks (workspace_id, status, due_at, id) where deleted_at is null;
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_source_meeting_id_idx on public.tasks (source_meeting_id);
create index tasks_source_event_id_idx on public.tasks (source_event_id);
create index task_documents_document_id_idx on public.task_documents (document_id);
create index task_documents_workspace_id_idx on public.task_documents (workspace_id);
create index quick_links_workspace_category_active_idx on public.quick_links (workspace_id, category, title) where deleted_at is null;
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index notification_outbox_pending_idx on public.notification_outbox (available_at, id) where processed_at is null;
create index audit_log_workspace_created_idx on public.audit_log (workspace_id, created_at desc, id);
create index folders_search_idx on public.folders using gin (search_vector);
create index documents_search_idx on public.documents using gin (search_vector);
create index events_search_idx on public.events using gin (search_vector);
create index meetings_search_idx on public.meetings using gin (search_vector);
create index tasks_search_idx on public.tasks using gin (search_vector);
create index quick_links_search_idx on public.quick_links using gin (search_vector);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger folders_set_updated_at before update on public.folders for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger meetings_set_updated_at before update on public.meetings for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger quick_links_set_updated_at before update on public.quick_links for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and active = true
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and role = 'owner'
      and active = true
  );
$$;

create or replace function public.can_view_profile(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_user_id = (select auth.uid()) or exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and mine.active = true
      and theirs.user_id = target_user_id and theirs.active = true
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created after insert or update of email on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_final_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and old.active = true and (tg_op = 'DELETE' or new.role <> 'owner' or new.active = false) then
    if not exists (
      select 1 from public.workspace_members
      where workspace_id = old.workspace_id and user_id <> old.user_id and role = 'owner' and active = true
    ) then
      raise exception 'The final workspace owner cannot be removed or deactivated';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger workspace_members_protect_final_owner before update or delete on public.workspace_members
for each row execute function public.protect_final_owner();

create or replace function public.audit_content_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_json jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  workspace_key bigint := (row_json ->> 'workspace_id')::bigint;
  record_name text := coalesce(row_json ->> 'name', row_json ->> 'title', tg_table_name);
begin
  insert into public.audit_log (workspace_id, actor_id, action, entity_kind, entity_id, entity_name, metadata)
  values (
    workspace_key,
    (select auth.uid()),
    case when tg_op = 'INSERT' then 'created' when tg_op = 'DELETE' then 'deleted' when (row_json ->> 'deleted_at') is not null then 'archived' else 'updated' end,
    tg_table_name,
    row_json ->> 'id',
    record_name,
    jsonb_build_object('operation', tg_op)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger folders_audit after insert or update or delete on public.folders for each row execute function public.audit_content_change();
create trigger documents_audit after insert or update or delete on public.documents for each row execute function public.audit_content_change();
create trigger events_audit after insert or update or delete on public.events for each row execute function public.audit_content_change();
create trigger meetings_audit after insert or update or delete on public.meetings for each row execute function public.audit_content_change();
create trigger tasks_audit after insert or update or delete on public.tasks for each row execute function public.audit_content_change();
create trigger quick_links_audit after insert or update or delete on public.quick_links for each row execute function public.audit_content_change();

create or replace function public.notify_task_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recipient_email text;
  dedupe_key text;
begin
  if new.assignee_id is null or (tg_op = 'UPDATE' and old.assignee_id = new.assignee_id) then return new; end if;
  dedupe_key := 'task-assigned:' || new.id || ':' || new.assignee_id || ':' || extract(epoch from new.updated_at)::bigint;
  select email into recipient_email from public.profiles where id = new.assignee_id;
  insert into public.notifications (workspace_id, user_id, title, body, event_key)
  values (new.workspace_id, new.assignee_id, 'Task assigned', new.title, dedupe_key)
  on conflict (user_id, event_key) do nothing;
  if coalesce((select email_enabled from public.notification_preferences where workspace_id = new.workspace_id and user_id = new.assignee_id), true) then
    insert into public.notification_outbox (workspace_id, user_id, recipient_email, subject, body_html, event_key)
    values (new.workspace_id, new.assignee_id, recipient_email, 'Task assigned: ' || new.title, '<p>You were assigned <strong>' || encode(convert_to(new.title, 'UTF8'), 'escape') || '</strong>.</p>', dedupe_key)
    on conflict (event_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger tasks_notify_assignment after insert or update of assignee_id on public.tasks
for each row execute function public.notify_task_assignment();

create or replace function public.create_due_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare reminder record;
begin
  for reminder in
    select t.*, p.email
    from public.tasks t
    join public.profiles p on p.id = t.assignee_id
    where t.deleted_at is null and t.status <> 'done'
      and t.due_at > now() and t.due_at <= now() + interval '24 hours'
  loop
    insert into public.notifications (workspace_id, user_id, title, body, event_key)
    values (reminder.workspace_id, reminder.assignee_id, 'Due within 24 hours', reminder.title, 'task-due:' || reminder.id || ':' || reminder.due_at::date)
    on conflict (user_id, event_key) do nothing;
    if coalesce((select email_enabled from public.notification_preferences where workspace_id = reminder.workspace_id and user_id = reminder.assignee_id), true) then
      insert into public.notification_outbox (workspace_id, user_id, recipient_email, subject, body_html, event_key)
      values (reminder.workspace_id, reminder.assignee_id, reminder.email, 'Due soon: ' || reminder.title, '<p>Your task <strong>' || encode(convert_to(reminder.title, 'UTF8'), 'escape') || '</strong> is due within 24 hours.</p>', 'task-due:' || reminder.id || ':' || reminder.due_at::date)
      on conflict (event_key) do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.bootstrap_workspace(workspace_name text default 'Partner Schools Hub')
returns bigint language plpgsql security definer set search_path = '' as $$
declare new_workspace_id bigint;
declare current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.workspace_members where user_id = current_user_id) then raise exception 'User already belongs to a workspace'; end if;
  update public.profiles set full_name = 'Jan Baloglu', updated_at = now() where id = current_user_id;
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

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.tasks enable row level security;
alter table public.task_documents enable row level security;
alter table public.quick_links enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.audit_log enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.workspaces, public.profiles, public.workspace_members, public.folders, public.documents, public.document_versions, public.events, public.event_attendees, public.meetings, public.meeting_attendees, public.tasks, public.task_documents, public.quick_links, public.notifications, public.notification_preferences to authenticated;
grant insert, update on public.folders, public.documents, public.document_versions, public.events, public.event_attendees, public.meetings, public.meeting_attendees, public.tasks, public.task_documents, public.quick_links, public.notifications, public.notification_preferences to authenticated;
grant update on public.workspaces to authenticated;
grant select on public.audit_log to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy workspaces_select on public.workspaces for select to authenticated using ((select public.is_workspace_member(id)));
create policy workspaces_update on public.workspaces for update to authenticated using ((select public.is_workspace_owner(id))) with check ((select public.is_workspace_owner(id)));
create policy profiles_select on public.profiles for select to authenticated using ((select public.can_view_profile(id)));
create policy workspace_members_select on public.workspace_members for select to authenticated using ((select public.is_workspace_member(workspace_id)));

create policy folders_select on public.folders for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy folders_insert on public.folders for insert to authenticated with check ((select public.is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy folders_update on public.folders for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));
create policy documents_select on public.documents for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy documents_insert on public.documents for insert to authenticated with check ((select public.is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy documents_update on public.documents for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));
create policy document_versions_select on public.document_versions for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy document_versions_insert on public.document_versions for insert to authenticated with check ((select public.is_workspace_member(workspace_id)) and uploaded_by = (select auth.uid()));

create policy events_select on public.events for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy events_insert on public.events for insert to authenticated with check ((select public.is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy events_update on public.events for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));
create policy event_attendees_select on public.event_attendees for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy event_attendees_insert on public.event_attendees for insert to authenticated with check ((select public.is_workspace_member(workspace_id)));
create policy event_attendees_update on public.event_attendees for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));

create policy meetings_select on public.meetings for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy meetings_insert on public.meetings for insert to authenticated with check ((select public.is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy meetings_update on public.meetings for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));
create policy meeting_attendees_select on public.meeting_attendees for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy meeting_attendees_insert on public.meeting_attendees for insert to authenticated with check ((select public.is_workspace_member(workspace_id)));
create policy meeting_attendees_update on public.meeting_attendees for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));

create policy tasks_select on public.tasks for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy tasks_insert on public.tasks for insert to authenticated with check ((select public.is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));
create policy task_documents_select on public.task_documents for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy task_documents_insert on public.task_documents for insert to authenticated with check ((select public.is_workspace_member(workspace_id)));
create policy task_documents_update on public.task_documents for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));

create policy quick_links_select on public.quick_links for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy quick_links_insert on public.quick_links for insert to authenticated with check ((select public.is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy quick_links_update on public.quick_links for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()) and (select public.is_workspace_member(workspace_id)));
create policy notifications_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_preferences_select on public.notification_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy notification_preferences_insert on public.notification_preferences for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_workspace_member(workspace_id)));
create policy notification_preferences_update on public.notification_preferences for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy audit_log_select on public.audit_log for select to authenticated using ((select public.is_workspace_owner(workspace_id)));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-documents',
  'company-documents',
  false,
  52428800,
  array[
    'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg','image/png','image/webp','image/gif','text/plain','text/csv'
  ]
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Storage objects are accessed only through the file-access Edge Function.
-- The function validates membership and uses the server-only secret key to issue 5-minute signed URLs.
