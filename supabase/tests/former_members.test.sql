begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-4000-8000-000000009061','qa-developer@invalid.example',now(),'{"full_name":"QA Developer"}'),
('00000000-0000-4000-8000-000000009062','qa-manager@invalid.example',now(),'{"full_name":"QA Manager"}'),
('00000000-0000-4000-8000-000000009063','qa-reader@invalid.example',now(),'{"full_name":"QA Reader"}'),
('00000000-0000-4000-8000-000000009064','qa-former@invalid.example',now(),'{"full_name":"QA Former"}');
update auth.users set encrypted_password='fixture-password-hash'
where id in ('00000000-0000-4000-8000-000000009061','00000000-0000-4000-8000-000000009062','00000000-0000-4000-8000-000000009063','00000000-0000-4000-8000-000000009064');
insert into public.workspaces(id,name) overriding system value values (-9061,'QA Member Lifecycle'),(-9062,'QA Other Workspace');
insert into public.workspace_members(workspace_id,user_id,role,active,can_clear_logs) values
(-9061,'00000000-0000-4000-8000-000000009061','super_admin',true,true),
(-9061,'00000000-0000-4000-8000-000000009062','super_admin',true,false),
(-9061,'00000000-0000-4000-8000-000000009063','admin',true,false),
(-9061,'00000000-0000-4000-8000-000000009064','admin',false,false);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009063',true);
select is((select count(*)::int from public.workspace_members where workspace_id=-9061),3,'Admin can read the active team');
select is(public.can_view_profile('00000000-0000-4000-8000-000000009062'),true,'Admin can see a colleague profile');
select is(public.can_view_profile('00000000-0000-4000-8000-000000009064'),false,'Admin cannot read a former profile');
select is(public.can_delete_former_member(-9061,'00000000-0000-4000-8000-000000009064'),false,'Admin cannot permanently delete');
select ok(not has_table_privilege('authenticated','public.workspace_members','delete'),'browser has no direct membership delete grant');
select ok(not has_table_privilege('authenticated','auth.users','delete'),'browser cannot delete Auth accounts');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009062',true);
select is((select count(*)::int from public.workspace_members where workspace_id=-9061),4,'Super Admin sees active and former members');
select is(public.can_view_profile('00000000-0000-4000-8000-000000009064'),true,'Super Admin sees former member identity');
select is(public.can_delete_former_member(-9061,'00000000-0000-4000-8000-000000009064'),false,'Jan-equivalent cannot permanently delete accounts');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009061',true);
select is(public.can_delete_former_member(-9061,'00000000-0000-4000-8000-000000009064'),true,'Developer can permanently delete a former Admin');
select is(public.can_delete_former_member(-9061,'00000000-0000-4000-8000-000000009063'),false,'Active Admin protected from permanent deletion');
select is(public.can_delete_former_member(-9061,'00000000-0000-4000-8000-000000009061'),false,'Developer cannot delete own account');
select is(public.can_delete_former_member(-9061,'00000000-0000-4000-8000-000000009062'),false,'Super Admin account protected');
select is(public.can_delete_former_member(-9062,'00000000-0000-4000-8000-000000009064'),false,'Cross-workspace deletion denied');
reset role;
insert into public.workspace_members(workspace_id,user_id,role,active) values (-9062,'00000000-0000-4000-8000-000000009064','admin',false);
set local role authenticated;
select is(public.can_delete_former_member(-9061,'00000000-0000-4000-8000-000000009064'),false,'Account linked to another workspace cannot be deleted');
reset role;
delete from public.workspace_members where workspace_id=-9062;

insert into public.folders(id,workspace_id,name,created_by) overriding system value values (-9061,-9061,'Keep folder','00000000-0000-4000-8000-000000009064');
insert into public.documents(id,workspace_id,folder_id,name,owner_id,created_by) overriding system value values (-9061,-9061,-9061,'Keep file','00000000-0000-4000-8000-000000009064','00000000-0000-4000-8000-000000009064');
insert into public.document_versions(workspace_id,document_id,version_number,storage_path,size_bytes,mime_type,uploaded_by) values (-9061,-9061,1,'-9061/qa-keep.txt',1,'text/plain','00000000-0000-4000-8000-000000009064');
insert into public.events(id,workspace_id,title,starts_at,ends_at,created_by) overriding system value values (-9061,-9061,'Keep event',now(),now()+interval '1 hour','00000000-0000-4000-8000-000000009064');
insert into public.meetings(id,workspace_id,title,starts_at,ends_at,created_by) overriding system value values (-9061,-9061,'Keep meeting',now(),now()+interval '1 hour','00000000-0000-4000-8000-000000009064');
insert into public.tasks(id,workspace_id,title,assignee_id,due_at,created_by) overriding system value values (-9061,-9061,'Keep task','00000000-0000-4000-8000-000000009064',now(),'00000000-0000-4000-8000-000000009064');
insert into public.quick_links(id,workspace_id,title,url,created_by) overriding system value values (-9061,-9061,'Keep link','https://example.com','00000000-0000-4000-8000-000000009064');
insert into public.chat_messages(workspace_id,sender_id,body,client_id) values (-9061,'00000000-0000-4000-8000-000000009064','Keep history','00000000-0000-4000-8000-000000009065');
insert into public.chat_read_states(workspace_id,user_id) values (-9061,'00000000-0000-4000-8000-000000009064');
insert into public.audit_log(workspace_id,actor_id,action,entity_kind,entity_id,entity_name) values (-9061,'00000000-0000-4000-8000-000000009064','created','task','-9061','Keep task');
select lives_ok($q$delete from auth.users where id='00000000-0000-4000-8000-000000009064'$q$,'Auth hard deletion succeeds with linked shared content');
select is((select count(*)::int from public.profiles where id='00000000-0000-4000-8000-000000009064'),0,'Profile removed');
select is((select count(*)::int from public.workspace_members where user_id='00000000-0000-4000-8000-000000009064'),0,'Membership removed');
select is((select count(*)::int from public.account_activation where user_id='00000000-0000-4000-8000-000000009064'),0,'Private activation record removed');
select is((select count(*)::int from public.chat_read_states where user_id='00000000-0000-4000-8000-000000009064'),0,'Private chat state removed');
select ok((select created_by is null from public.folders where id=-9061),'Folder retained without false attribution');
select ok((select owner_id is null and created_by is null from public.documents where id=-9061),'File retained without false attribution');
select ok((select uploaded_by is null and storage_path='-9061/qa-keep.txt' from public.document_versions where document_id=-9061),'Version and storage path retained');
select ok((select created_by is null from public.events where id=-9061),'Event retained');
select ok((select created_by is null from public.meetings where id=-9061),'Meeting retained');
select ok((select assignee_id is null and created_by is null from public.tasks where id=-9061),'Task retained as unassigned');
select ok((select created_by is null from public.quick_links where id=-9061),'Quick link retained');
select ok((select sender_id is null and body='Keep history' from public.chat_messages where workspace_id=-9061),'Chat retained with former sender');
select is((select count(*)::int from public.audit_log where workspace_id=-9061 and actor_id='00000000-0000-4000-8000-000000009064'),0,'Audit no longer references deleted identity');
select ok((select count(*) from public.audit_log where workspace_id=-9061)>0,'Audit history retained');
select * from finish();
rollback;
