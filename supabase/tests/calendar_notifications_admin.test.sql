-- Transaction-only verification for shared events, private meetings,
-- assignment notifications, preferences, and developer-only full log clearing.
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

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-4000-8000-000000009071','calendar-developer@invalid.example',now(),'{}'),
('00000000-0000-4000-8000-000000009072','calendar-attendee@invalid.example',now(),'{}'),
('00000000-0000-4000-8000-000000009073','calendar-nonattendee@invalid.example',now(),'{}');
update auth.users set encrypted_password='fixture-password-hash'
where id in ('00000000-0000-4000-8000-000000009071','00000000-0000-4000-8000-000000009072','00000000-0000-4000-8000-000000009073');
insert into public.workspaces(id,name) overriding system value values (-9071,'Calendar QA');
insert into public.workspace_members(workspace_id,user_id,role,active,can_clear_logs) values
(-9071,'00000000-0000-4000-8000-000000009071','super_admin',true,true),
(-9071,'00000000-0000-4000-8000-000000009072','admin',true,false),
(-9071,'00000000-0000-4000-8000-000000009073','admin',true,false);
insert into public.notification_preferences(workspace_id,user_id,email_enabled) values
(-9071,'00000000-0000-4000-8000-000000009071',false),
(-9071,'00000000-0000-4000-8000-000000009072',true),
(-9071,'00000000-0000-4000-8000-000000009073',false);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009071',true);
insert into tap_output(result) select lives_ok($q$select public.create_workspace_item(-9071, '{"kind":"event","title":"Everyone <script>alert(1)</script>","startDate":"2026-09-08T01:00:00Z","endDate":"2026-09-08T02:00:00Z","attendeeIds":["00000000-0000-4000-8000-000000009072"]}')$q$, 'event creation succeeds');
insert into tap_output(result) select lives_ok($q$select public.create_workspace_item(-9071, '{"kind":"meeting","title":"Private attendee meeting","startDate":"2026-09-09T01:00:00Z","endDate":"2026-09-09T02:00:00Z","attendeeIds":["00000000-0000-4000-8000-000000009072"]}')$q$, 'meeting creation succeeds');
insert into tap_output(result) select lives_ok($q$select public.create_workspace_item(-9071, '{"kind":"task","title":"Assigned follow-up","dueDate":"2026-09-10T01:00:00Z","assigneeId":"00000000-0000-4000-8000-000000009072"}')$q$, 'task creation succeeds');
insert into tap_output(result) select is((select count(*)::int from public.events where workspace_id=-9071),1,'creator sees shared event');
insert into tap_output(result) select is((select count(*)::int from public.meetings where workspace_id=-9071),1,'creator is automatically a meeting attendee');
insert into tap_output(result) select is((select count(*)::int from public.meeting_attendees where workspace_id=-9071),2,'creator and selected attendee are recorded');
reset role;

insert into tap_output(result) select is((select count(*)::int from public.notifications where workspace_id=-9071 and user_id='00000000-0000-4000-8000-000000009072'),3,'event, meeting, and task create three in-app notifications');
insert into tap_output(result) select is((select count(*)::int from public.notification_outbox where workspace_id=-9071 and user_id='00000000-0000-4000-8000-000000009072'),3,'enabled attendee receives three email jobs');
insert into tap_output(result) select is((select count(*)::int from public.notification_outbox where workspace_id=-9071 and user_id='00000000-0000-4000-8000-000000009071'),0,'disabled email preference is respected');
insert into tap_output(result) select ok((select bool_and(body_html not like '%<script%') from public.notification_outbox where workspace_id=-9071),'email bodies contain no injected markup');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009072',true);
insert into tap_output(result) select is((select count(*)::int from public.events where workspace_id=-9071),1,'attendee sees shared event');
insert into tap_output(result) select is((select count(*)::int from public.meetings where workspace_id=-9071),1,'selected attendee sees private meeting');
insert into tap_output(result) select is((select count(*)::int from public.meeting_attendees where workspace_id=-9071),2,'attendee can see the meeting participant list');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009073',true);
insert into tap_output(result) select is((select count(*)::int from public.events where workspace_id=-9071),1,'non-attendee also sees shared event');
insert into tap_output(result) select is((select count(*)::int from public.meetings where workspace_id=-9071),0,'non-attendee cannot see private meeting');
insert into tap_output(result) select is((select count(*)::int from public.meeting_attendees where workspace_id=-9071),0,'non-attendee cannot infer meeting participants');
insert into tap_output(result) select throws_ok($q$select public.clear_workspace_log(-9071,'all')$q$,'P0001','Log-clearing permission required','Admin cannot clear every log');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009071',true);
insert into tap_output(result) select lives_ok($q$select public.clear_workspace_log(-9071,'all')$q$,'developer can clear every audit log');
insert into tap_output(result) select is((select count(*)::int from public.audit_log where workspace_id=-9071),0,'full log clearing removes activity and member history');
insert into tap_output(result) select throws_ok($q$select public.clear_workspace_log(-9071,'everything')$q$,'P0001','Invalid log scope','unknown clear scope rejected');
reset role;

insert into tap_output(result) select * from finish();
select result from tap_output order by sequence;
rollback;
