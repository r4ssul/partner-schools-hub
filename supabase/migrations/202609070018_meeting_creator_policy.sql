-- Evaluate creator ownership directly on the protected row. This is required
-- for INSERT ... RETURNING because stable helper queries use the command's
-- earlier snapshot and cannot yet observe the newly inserted meeting row.

drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings for select to authenticated
using (
  created_by = (select auth.uid())
  or (select public.is_meeting_attendee(id, workspace_id))
);

drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings for update to authenticated
using (
  created_by = (select auth.uid())
  or (select public.is_meeting_attendee(id, workspace_id))
)
with check (
  created_by = (select auth.uid())
  or (select public.is_meeting_attendee(id, workspace_id))
);

notify pgrst, 'reload schema';
