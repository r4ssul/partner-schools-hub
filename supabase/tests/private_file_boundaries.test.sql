-- Transaction-only security fixtures; nothing remains in the workspace.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create temporary table tap_output (
  sequence bigint generated always as identity,
  result text not null
);
grant insert, select on tap_output to authenticated;
grant usage, select on sequence tap_output_sequence_seq to authenticated;
insert into tap_output(result) select no_plan();

insert into auth.users(id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000009901', 'file-member-a@invalid.example', '{}'),
  ('00000000-0000-4000-8000-000000009902', 'file-member-b@invalid.example', '{}');
update auth.users set email_confirmed_at = now(), encrypted_password = 'fixture-password-hash'
where id in ('00000000-0000-4000-8000-000000009901', '00000000-0000-4000-8000-000000009902');
insert into public.workspaces(id, name) overriding system value values
  (-9901, 'File boundary A'), (-9902, 'File boundary B');
insert into public.workspace_members(workspace_id, user_id, role) values
  (-9901, '00000000-0000-4000-8000-000000009901', 'super_admin'),
  (-9902, '00000000-0000-4000-8000-000000009902', 'super_admin');
insert into public.folders(id, workspace_id, name, created_by) overriding system value values
  (-9901, -9901, 'Files A', '00000000-0000-4000-8000-000000009901'),
  (-9902, -9902, 'Files B', '00000000-0000-4000-8000-000000009902');
insert into public.documents(id, workspace_id, folder_id, name, owner_id, created_by) overriding system value values
  (-9901, -9901, -9901, 'A.txt', '00000000-0000-4000-8000-000000009901', '00000000-0000-4000-8000-000000009901'),
  (-9902, -9902, -9902, 'B.txt', '00000000-0000-4000-8000-000000009902', '00000000-0000-4000-8000-000000009902');
insert into public.document_versions(id, workspace_id, document_id, version_number, storage_path, storage_provider, size_bytes, mime_type, uploaded_by)
overriding system value values (-9902, -9902, -9902, 1, '-9902/private-file.txt', 'r2', 1, 'text/plain', '00000000-0000-4000-8000-000000009902');

insert into tap_output(result) select ok(not has_table_privilege('authenticated', 'public.document_versions', 'INSERT'),
  'browser sessions cannot forge file versions');
insert into tap_output(result) select ok(not has_function_privilege('anon', 'public.create_due_reminders()', 'EXECUTE'),
  'anonymous callers cannot trigger reminder processing');
insert into tap_output(result) select ok(not has_function_privilege('anon', 'public.get_r2_download(bigint)', 'EXECUTE'),
  'anonymous callers cannot request R2 object keys');
insert into tap_output(result) select ok(not has_function_privilege('anon', 'public.register_r2_upload(bigint,bigint,bigint,text,text,text,bigint)', 'EXECUTE'),
  'anonymous callers cannot register R2 versions');
insert into tap_output(result) select ok(not has_function_privilege('authenticated', 'public.audit_content_change()', 'EXECUTE'),
  'signed-in callers cannot invoke audit trigger helpers directly');
insert into tap_output(result) select ok((select convalidated from pg_constraint where conname = 'versions_document_workspace_fk'),
  'file versions have a validated workspace relationship');
insert into tap_output(result) select ok((select convalidated from pg_constraint where conname = 'versions_storage_workspace_prefix'),
  'file storage keys have a validated workspace prefix');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009901', true);
insert into tap_output(result) select throws_ok($q$select * from public.get_r2_download(-9902)$q$, 'P0001',
  'File not found or access denied', 'member A cannot authorize a file in workspace B');
insert into tap_output(result) select throws_ok($q$insert into public.document_versions(workspace_id, document_id, version_number, storage_path, storage_provider, size_bytes, mime_type, uploaded_by)
  values (-9901, -9901, 1, '-9901/forged.txt', 'r2', 1, 'text/plain', '00000000-0000-4000-8000-000000009901')$q$,
  '42501', null, 'member A cannot insert a forged file version');
reset role;

insert into tap_output(result) select throws_ok($q$insert into public.document_versions(workspace_id, document_id, version_number, storage_path, storage_provider, size_bytes, mime_type, uploaded_by)
  values (-9901, -9902, 2, '-9901/cross-workspace.txt', 'r2', 1, 'text/plain', '00000000-0000-4000-8000-000000009901')$q$,
  '23503', null, 'cross-workspace document relationship is rejected');
insert into tap_output(result) select throws_ok($q$insert into public.document_versions(workspace_id, document_id, version_number, storage_path, storage_provider, size_bytes, mime_type, uploaded_by)
  values (-9901, -9901, 1, '-9902/foreign-key.txt', 'r2', 1, 'text/plain', '00000000-0000-4000-8000-000000009901')$q$,
  '23514', null, 'cross-workspace object key is rejected');

insert into tap_output(result) select * from finish();
select result from tap_output order by sequence;
rollback;
