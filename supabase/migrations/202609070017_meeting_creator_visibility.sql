-- A meeting creator is involved from the instant the meeting row is created.
-- Including the creator directly in the visibility helper lets INSERT ...
-- RETURNING complete before the after-insert attendee backfill runs.

create or replace function public.is_meeting_attendee(target_meeting_id bigint, target_workspace_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_workspace_member(target_workspace_id) and (
    exists (
      select 1 from public.meeting_attendees
      where meeting_id = target_meeting_id
        and workspace_id = target_workspace_id
        and user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.meetings
      where id = target_meeting_id
        and workspace_id = target_workspace_id
        and created_by = (select auth.uid())
    )
  );
$$;
revoke all on function public.is_meeting_attendee(bigint, bigint) from public, anon;
grant execute on function public.is_meeting_attendee(bigint, bigint) to authenticated;

notify pgrst, 'reload schema';
