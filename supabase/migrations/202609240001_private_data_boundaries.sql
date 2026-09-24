-- Browsers never insert file versions directly. The scoped R2 RPC or service
-- role may write them; the upload Worker verifies the object before RPC use.
revoke insert on public.document_versions from authenticated;

-- Cron runs this function as its database owner. It is not a public RPC.
revoke all on function public.create_due_reminders() from public, anon, authenticated;

-- SECURITY DEFINER helpers should never be public RPCs. The trigger helpers
-- also do not need direct execution by signed-in users.
revoke all on function public.audit_content_change() from public, anon, authenticated;
revoke all on function public.ensure_meeting_creator_attends() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.notify_event_assignment() from public, anon, authenticated;
revoke all on function public.notify_meeting_assignment() from public, anon, authenticated;
revoke all on function public.notify_task_assignment() from public, anon, authenticated;
revoke all on function public.protect_final_owner() from public, anon, authenticated;
revoke all on function public.can_view_profile(uuid) from public, anon;
revoke all on function public.is_workspace_member(bigint) from public, anon;
revoke all on function public.is_workspace_owner(bigint) from public, anon;
revoke all on function public.is_workspace_auditor(bigint) from public, anon;
revoke all on function public.register_r2_upload(bigint, bigint, bigint, text, text, text, bigint) from public, anon;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.is_workspace_member(bigint) to authenticated;
grant execute on function public.is_workspace_owner(bigint) to authenticated;
grant execute on function public.is_workspace_auditor(bigint) to authenticated;
grant execute on function public.register_r2_upload(bigint, bigint, bigint, text, text, text, bigint) to authenticated;

-- Keep each relationship within its workspace even when a client sends raw
-- PostgREST requests instead of using the application's creation form.
alter table public.folders add constraint folders_workspace_id_id_unique unique (workspace_id, id);
alter table public.documents add constraint documents_workspace_id_id_unique unique (workspace_id, id);
alter table public.events add constraint events_workspace_id_id_unique unique (workspace_id, id);
alter table public.meetings add constraint meetings_workspace_id_id_unique unique (workspace_id, id);
alter table public.tasks add constraint tasks_workspace_id_id_unique unique (workspace_id, id);

alter table public.folders add constraint folders_parent_workspace_fk
  foreign key (workspace_id, parent_id) references public.folders(workspace_id, id) not valid;
alter table public.documents add constraint documents_folder_workspace_fk
  foreign key (workspace_id, folder_id) references public.folders(workspace_id, id) not valid;
alter table public.document_versions add constraint versions_document_workspace_fk
  foreign key (workspace_id, document_id) references public.documents(workspace_id, id) not valid;
alter table public.event_attendees add constraint event_attendees_workspace_fk
  foreign key (workspace_id, event_id) references public.events(workspace_id, id) not valid;
alter table public.event_attendees add constraint event_attendees_member_workspace_fk
  foreign key (workspace_id, user_id) references public.workspace_members(workspace_id, user_id)
  on delete cascade not valid;
alter table public.meeting_attendees add constraint meeting_attendees_workspace_fk
  foreign key (workspace_id, meeting_id) references public.meetings(workspace_id, id) not valid;
alter table public.meeting_attendees add constraint meeting_attendees_member_workspace_fk
  foreign key (workspace_id, user_id) references public.workspace_members(workspace_id, user_id)
  on delete cascade not valid;
alter table public.tasks add constraint tasks_assignee_workspace_fk
  foreign key (workspace_id, assignee_id) references public.workspace_members(workspace_id, user_id)
  on delete set null (assignee_id) not valid;
alter table public.task_documents add constraint task_documents_task_workspace_fk
  foreign key (workspace_id, task_id) references public.tasks(workspace_id, id) not valid;
alter table public.task_documents add constraint task_documents_file_workspace_fk
  foreign key (workspace_id, document_id) references public.documents(workspace_id, id) not valid;

-- Storage keys are always scoped by workspace ID. A forged version pointing
-- at another workspace's object cannot be used to read that object.
alter table public.document_versions add constraint versions_storage_workspace_prefix
  check (storage_path like workspace_id::text || '/%') not valid;

alter table public.folders validate constraint folders_parent_workspace_fk;
alter table public.documents validate constraint documents_folder_workspace_fk;
alter table public.document_versions validate constraint versions_document_workspace_fk;
alter table public.event_attendees validate constraint event_attendees_workspace_fk;
alter table public.event_attendees validate constraint event_attendees_member_workspace_fk;
alter table public.meeting_attendees validate constraint meeting_attendees_workspace_fk;
alter table public.meeting_attendees validate constraint meeting_attendees_member_workspace_fk;
alter table public.tasks validate constraint tasks_assignee_workspace_fk;
alter table public.task_documents validate constraint task_documents_task_workspace_fk;
alter table public.task_documents validate constraint task_documents_file_workspace_fk;
alter table public.document_versions validate constraint versions_storage_workspace_prefix;

create or replace function public.get_r2_download(target_version_id bigint)
returns table(object_key text, file_name text, file_mime_type text, file_size bigint)
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  record_workspace_id bigint;
  record_document_id bigint;
  record_object_key text;
  record_file_name text;
  record_mime_type text;
  record_size bigint;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  select v.workspace_id, v.document_id, v.storage_path, d.name, v.mime_type, v.size_bytes
  into record_workspace_id, record_document_id, record_object_key, record_file_name, record_mime_type, record_size
  from public.document_versions v
  join public.documents d on d.id = v.document_id and d.workspace_id = v.workspace_id
  where v.id = target_version_id and v.storage_provider = 'r2' and d.deleted_at is null
    and v.storage_path like v.workspace_id::text || '/%';
  if record_workspace_id is null or not public.is_workspace_member(record_workspace_id) then
    raise exception 'File not found or access denied';
  end if;

  insert into public.audit_log (workspace_id, actor_id, action, entity_kind, entity_id, entity_name, metadata)
  values (record_workspace_id, actor_id, 'accessed', 'document', record_document_id::text,
    record_file_name, jsonb_build_object('version_id', target_version_id, 'storage_provider', 'r2'));

  return query select record_object_key, record_file_name, record_mime_type, record_size;
end;
$$;

revoke all on function public.get_r2_download(bigint) from public, anon;
grant execute on function public.get_r2_download(bigint) to authenticated;

notify pgrst, 'reload schema';
