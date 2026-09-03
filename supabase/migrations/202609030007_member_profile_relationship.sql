do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_members_profile_fkey'
      and conrelid = 'public.workspace_members'::regclass
  ) then
    alter table public.workspace_members
      add constraint workspace_members_profile_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end;
$$;

notify pgrst, 'reload schema';
