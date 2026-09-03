create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'partner-schools-hub-due-reminders') then
    perform cron.unschedule('partner-schools-hub-due-reminders');
  end if;
  perform cron.schedule(
    'partner-schools-hub-due-reminders',
    '0 23 * * *',
    'select public.create_due_reminders()'
  );
end;
$$;

-- Configure a second scheduled HTTP job for dispatch-notifications after storing
-- project_url, publishable_key, and a dispatch secret in Supabase Vault.
