-- Meetings now follow the same workspace-wide visibility model as events.
-- Attendees remain useful for assignment notifications and participation lists,
-- but they no longer determine who can read or update a meeting.

drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings for select to authenticated
using ((select public.is_workspace_member(workspace_id)));

drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings for update to authenticated
using ((select public.is_workspace_member(workspace_id)))
with check ((select public.is_workspace_member(workspace_id)));

drop policy if exists meeting_attendees_select on public.meeting_attendees;
create policy meeting_attendees_select on public.meeting_attendees for select to authenticated
using ((select public.is_workspace_member(workspace_id)));

notify pgrst, 'reload schema';
