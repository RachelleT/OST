-- Enable required extensions (safe to run even if already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the send-reminders Edge Function to run every 15 minutes.
-- Replace <YOUR_PROJECT_REF> with your Supabase project ref (e.g. lfgsnikjqckqryvxiirr)
-- Replace <YOUR_ANON_KEY> with your anon key from .env.local

select cron.schedule(
  'send-reminders-every-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <YOUR_ANON_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
