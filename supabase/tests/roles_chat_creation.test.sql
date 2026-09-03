-- Transaction-only fixtures. No production records or messages are retained.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id, email, raw_user_meta_data) values
('00000000-0000-4000-8000-000000009041', 'qa-owner@invalid.example', '{"full_name":"QA Owner"}'),
('00000000-0000-4000-8000-000000009042', 'qa-super@invalid.example', '{"full_name":"QA Super"}'),
('00000000-0000-4000-8000-000000009043', 'qa-admin@invalid.example', '{"full_name":"QA Admin"}'),
('00000000-0000-4000-8000-000000009044', 'qa-stranger@invalid.example', '{"full_name":"QA Stranger"}');
insert into public.workspaces(id, name) overriding system value values (-9041, 'QA Workspace'), (-9042, 'Other QA Workspace');
insert into public.workspace_members(workspace_id,user_id,role) values
(-9041,'00000000-0000-4000-8000-000000009041','owner'),
(-9041,'00000000-0000-4000-8000-000000009042','super_admin'),
(-9041,'00000000-0000-4000-8000-000000009043','admin'),
(-9042,'00000000-0000-4000-8000-000000009044','owner');
insert into public.folders(id,workspace_id,name,created_by) overriding system value values
(-9042,-9042,'Private folder','00000000-0000-4000-8000-000000009044');
insert into public.documents(id, workspace_id, folder_id, name, owner_id, created_by) overriding system value values
(-9042,-9042,-9042,'Private file','00000000-0000-4000-8000-000000009044','00000000-0000-4000-8000-000000009044');

select ok(not has_table_privilege('anon','public.chat_messages','select'), 'anonymous chat reads denied');
select ok(not has_function_privilege('anon','public.send_chat_message(bigint,text,uuid)','execute'), 'anonymous sends denied');
select ok(not has_table_privilege('authenticated','public.chat_messages','insert'), 'direct inserts and forged sender denied');
select ok(not has_table_privilege('authenticated','public.chat_messages','update'), 'message history cannot be edited');
select ok(not has_table_privilege('authenticated','public.chat_messages','delete'), 'message history cannot be deleted');
select ok(not has_table_privilege('authenticated','public.chat_read_states','update'), 'other members read status cannot be forged');
select ok((select relrowsecurity from pg_class where oid='public.chat_messages'::regclass), 'chat RLS enabled');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009043',true);
select is(public.is_workspace_manager(-9041), false, 'admin cannot manage membership/settings');
select throws_ok($q$select public.clear_workspace_log(-9041,'activity')$q$, 'P0001', 'Only the Owner can clear workspace logs', 'admin cannot clear logs');
select lives_ok($q$select public.send_chat_message(-9041,'Hello from Admin','00000000-0000-4000-8000-000000009099')$q$, 'admin can send');
select lives_ok($q$select public.send_chat_message(-9041,'Hello from Admin','00000000-0000-4000-8000-000000009099')$q$, 'retry is idempotent');
select is((select count(*)::int from public.chat_messages where workspace_id=-9041),1,'retry creates exactly one message');
select is((select sender_id::text from public.chat_messages where workspace_id=-9041),'00000000-0000-4000-8000-000000009043','sender comes from authenticated identity');
select throws_ok($q$select public.send_chat_message(-9041,'  ','00000000-0000-4000-8000-000000009098')$q$,'P0001','Messages must contain 1–2000 characters','blank message rejected');
select throws_ok($q$select public.send_chat_message(-9041,repeat('a',2001),'00000000-0000-4000-8000-000000009098')$q$,'P0001','Messages must contain 1–2000 characters','oversized message rejected');
select lives_ok($q$select public.mark_chat_read(-9041,(select max(id) from public.chat_messages where workspace_id=-9041))$q$,'read receipt saves');
select is((select count(*)::int from public.chat_read_states where workspace_id=-9041),1,'own read state is visible');
select throws_ok($q$select public.send_chat_message(-9042,'Not allowed','00000000-0000-4000-8000-000000009097')$q$,'P0001','Active workspace membership required','cross-workspace sends rejected');
select throws_ok($q$select public.create_workspace_item(-9041,'{"kind":"event","title":"Bad event","startDate":"2026-09-04T01:00Z","endDate":"2026-09-04T02:00Z","attendeeIds":["00000000-0000-4000-8000-000000009044"]}')$q$,'P0001','An attendee is no longer active','cross-workspace attendees rejected');
select throws_ok($q$select public.create_workspace_item(-9041,'{"kind":"task","title":"Bad task","dueDate":"2026-09-04T01:00Z","documentIds":["-9042"]}')$q$,'P0001','A linked file is no longer available','cross-workspace file rejected');
select is((select count(*)::int from public.events where workspace_id=-9041),0,'invalid creation does not leave an orphan event');
select lives_ok($q$select public.create_workspace_item(-9041,'{"kind":"meeting","title":"Valid meeting","startDate":"2026-09-04T01:00Z","endDate":"2026-09-04T02:00Z","attendeeIds":["00000000-0000-4000-8000-000000009043"]}')$q$,'meeting and attendees created atomically');
select is((select count(*)::int from public.meeting_attendees where workspace_id=-9041),1,'meeting attendee saved');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009042',true);
select is(public.is_workspace_manager(-9041),true,'super admin can manage workspace');
select lives_ok($q$update public.workspaces set name='Updated QA Workspace' where id=-9041$q$,'super admin can update settings');
select is((select name from public.workspaces where id=-9041),'Updated QA Workspace','settings update actually applied');
select throws_ok($q$select public.clear_workspace_log(-9041,'members')$q$,'P0001','Only the Owner can clear workspace logs','super admin cannot clear member log');
select throws_ok($q$select public.clear_workspace_log(-9041,'activity')$q$,'P0001','Only the Owner can clear workspace logs','super admin cannot clear activity log');
select is((select count(*)::int from public.chat_read_states where workspace_id=-9041),0,'another member read state is private');
select lives_ok($q$select public.send_chat_message(-9041,'Hello from Super Admin','00000000-0000-4000-8000-000000009096')$q$,'super admin can send');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009044',true);
select is((select count(*)::int from public.chat_messages where workspace_id=-9041),0,'non-member cannot read chat history');
select throws_ok($q$select public.mark_chat_read(-9041,1)$q$,'P0001','Active workspace membership required','non-member cannot mark messages read');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009041',true);
select is(public.is_workspace_manager(-9041),true,'owner can manage workspace');
select lives_ok($q$select public.clear_workspace_log(-9041,'activity')$q$,'owner can clear fixture activity');
select is((select count(*)::int from public.audit_log where workspace_id=-9041),0,'fixture log was actually cleared');
select throws_ok($q$select public.clear_workspace_log(-9041,null)$q$,'P0001','Invalid log scope','null scope cannot clear all logs accidentally');
reset role;
select throws_ok($q$update public.workspace_members set role='admin' where workspace_id=-9041 and role='owner'$q$,'P0001',null,'final owner remains protected');
update public.workspace_members set active=false where workspace_id=-9041 and user_id='00000000-0000-4000-8000-000000009043';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009043',true);
select is((select count(*)::int from public.chat_messages where workspace_id=-9041),0,'deactivated admin loses message access');
select throws_ok($q$select public.send_chat_message(-9041,'Inactive','00000000-0000-4000-8000-000000009095')$q$,'P0001','Active workspace membership required','deactivated admin cannot send');
reset role;
select * from finish();
rollback;
