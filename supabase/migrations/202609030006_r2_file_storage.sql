alter table public.document_versions
  add column if not exists storage_provider text not null default 'supabase';

alter table public.document_versions
  drop constraint if exists document_versions_storage_provider_check,
  add constraint document_versions_storage_provider_check check (storage_provider in ('supabase', 'r2'));

create or replace function public.register_r2_upload(
  target_workspace_id bigint,
  target_folder_id bigint,
  target_document_id bigint,
  target_object_key text,
  target_file_name text,
  target_mime_type text,
  target_size_bytes bigint
)
returns table(document_id bigint, version_id bigint, version_number bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  result_document_id bigint;
  result_version_id bigint;
  next_version bigint;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'Workspace access denied'; end if;
  if target_file_name is null or char_length(target_file_name) not between 1 and 240 then raise exception 'Invalid file name'; end if;
  if target_size_bytes is null or target_size_bytes not between 0 and 52428800 then raise exception 'Invalid file size'; end if;
  if target_mime_type not in (
    'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg','image/png','image/webp','image/gif','text/plain','text/csv'
  ) then raise exception 'Unsupported file type'; end if;
  if target_object_key is null or target_object_key not like target_workspace_id::text || '/%' then raise exception 'Invalid object key'; end if;

  if target_document_id is null then
    if not exists (
      select 1 from public.folders
      where id = target_folder_id and workspace_id = target_workspace_id and deleted_at is null
    ) then raise exception 'Folder not found'; end if;
    insert into public.documents (workspace_id, folder_id, name, owner_id, created_by)
    values (target_workspace_id, target_folder_id, target_file_name, actor_id, actor_id)
    returning id into result_document_id;
    next_version := 1;
  else
    select id into result_document_id
    from public.documents
    where id = target_document_id and workspace_id = target_workspace_id and deleted_at is null
    for update;
    if result_document_id is null then raise exception 'Document not found'; end if;
    select coalesce(max(v.version_number), 0) + 1 into next_version
    from public.document_versions v where v.document_id = result_document_id;
    update public.documents set name = target_file_name where id = result_document_id;
  end if;

  insert into public.document_versions (
    workspace_id, document_id, version_number, storage_path, storage_provider, size_bytes, mime_type, uploaded_by
  ) values (
    target_workspace_id, result_document_id, next_version, target_object_key, 'r2', target_size_bytes, target_mime_type, actor_id
  ) returning id into result_version_id;

  insert into public.audit_log (workspace_id, actor_id, action, entity_kind, entity_id, entity_name, metadata)
  values (
    target_workspace_id,
    actor_id,
    case when next_version = 1 then 'uploaded' else 'added version' end,
    'document',
    result_document_id::text,
    target_file_name,
    jsonb_build_object('version', next_version, 'size_bytes', target_size_bytes, 'storage_provider', 'r2')
  );

  return query select result_document_id, result_version_id, next_version;
end;
$$;

create or replace function public.get_r2_download(target_version_id bigint)
returns table(object_key text, file_name text, file_mime_type text, file_size bigint)
language plpgsql
security definer
set search_path = ''
as $$
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
  join public.documents d on d.id = v.document_id
  where v.id = target_version_id and v.storage_provider = 'r2' and d.deleted_at is null;
  if record_workspace_id is null or not public.is_workspace_member(record_workspace_id) then raise exception 'File not found or access denied'; end if;

  insert into public.audit_log (workspace_id, actor_id, action, entity_kind, entity_id, entity_name, metadata)
  values (record_workspace_id, actor_id, 'accessed', 'document', record_document_id::text, record_file_name, jsonb_build_object('version_id', target_version_id, 'storage_provider', 'r2'));

  return query select record_object_key, record_file_name, record_mime_type, record_size;
end;
$$;

revoke all on function public.register_r2_upload(bigint, bigint, bigint, text, text, text, bigint) from public;
revoke all on function public.get_r2_download(bigint) from public;
grant execute on function public.register_r2_upload(bigint, bigint, bigint, text, text, text, bigint) to authenticated;
grant execute on function public.get_r2_download(bigint) to authenticated;
