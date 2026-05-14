-- Tracks each reminder sent so we can prevent doubles and implement back-off.
-- One row per user per day (enforced by unique constraint).

create table reminder_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  date       date not null,        -- user's local date the reminder was for
  sent_at    timestamptz not null default now(),
  unique (user_id, date)
);

create index on reminder_log(user_id, date desc);

alter table reminder_log enable row level security;

-- Users can read their own log (useful for debugging / future UI)
create policy "users read own reminder log" on reminder_log
  for select using (auth.uid() = user_id);

-- Only the service role can insert (Edge Function runs as service role)
-- No insert policy needed — service role bypasses RLS
