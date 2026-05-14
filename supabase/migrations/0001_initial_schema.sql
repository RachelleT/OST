-- =============================================================
-- One Small Thing — Initial Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================

-- ----------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 3 and 30),
  timezone text not null default 'UTC',
  reminder_time time,
  is_admin boolean not null default false,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  created_at timestamptz not null default now()
);

create table prompts (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(text) between 5 and 200),
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table daily_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  prompt_id uuid not null references prompts(id),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index on daily_assignments(user_id, date desc);

create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  prompt_id uuid not null references prompts(id),
  date date not null,
  text text check (length(text) <= 280),
  photo_url text,
  share_anonymous boolean not null default false,
  share_with_name boolean not null default false,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'held', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (text is not null or photo_url is not null),
  unique (user_id, date)
);

create index on posts(user_id, date desc);
create index on posts(moderation_status) where moderation_status != 'approved';

create table grace_days_used (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  week_start date not null,
  used_for_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table moderation_queue (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  reason text not null,
  scores jsonb,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  decision text check (decision in ('approve', 'hide', 'ignore')),
  created_at timestamptz not null default now()
);

create table featured_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  display_mode text not null check (display_mode in ('anonymous', 'with_name')),
  featured_by uuid not null references profiles(id),
  featured_at timestamptz not null default now(),
  unfeatured_at timestamptz
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table config (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

insert into config (key, value) values ('bootstrap_admin_emails', '');

create table admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  invited_by uuid not null references profiles(id),
  invited_at timestamptz not null default now(),
  consumed_at timestamptz,
  consumed_by uuid references profiles(id)
);

create index on admin_invites(email) where consumed_at is null;

create table admin_audit (
  id uuid primary key default gen_random_uuid(),
  target_user uuid not null references profiles(id),
  action text not null check (action in ('promoted', 'demoted', 'invited', 'bootstrap_auto')),
  actor uuid references profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create index on admin_audit(target_user, created_at desc);

-- ----------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------

alter table profiles enable row level security;
alter table prompts enable row level security;
alter table daily_assignments enable row level security;
alter table posts enable row level security;
alter table grace_days_used enable row level security;
alter table moderation_queue enable row level security;
alter table featured_posts enable row level security;
alter table push_subscriptions enable row level security;
alter table config enable row level security;
alter table admin_invites enable row level security;
alter table admin_audit enable row level security;

-- profiles
create policy "users read own profile" on profiles
  for select using (auth.uid() = id);

create policy "users update own profile" on profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = (select is_admin from profiles where id = auth.uid())
  );

create policy "admins read all profiles" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- prompts
create policy "anyone reads active prompts" on prompts
  for select using (
    active = true or
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "admins write prompts" on prompts
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- daily_assignments
create policy "users read own assignments" on daily_assignments
  for select using (auth.uid() = user_id);

-- posts
create policy "users read own posts" on posts
  for select using (auth.uid() = user_id);

create policy "users write own posts" on posts
  for insert with check (auth.uid() = user_id);

create policy "users update own posts" on posts
  for update using (auth.uid() = user_id);

create policy "admins read all posts" on posts
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- grace_days_used
create policy "users read own grace days" on grace_days_used
  for select using (auth.uid() = user_id);

-- moderation_queue
create policy "admins manage moderation queue" on moderation_queue
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- featured_posts
create policy "admins manage featured posts" on featured_posts
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- push_subscriptions
create policy "users manage own subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id);

-- config
create policy "anyone reads config" on config
  for select using (auth.role() = 'authenticated');

create policy "admins write config" on config
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- admin_invites
create policy "admins manage invites" on admin_invites
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- admin_audit
create policy "admins read audit" on admin_audit
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ----------------------------------------------------------------
-- Helper functions
-- ----------------------------------------------------------------

-- Auto-create profile on first sign-in, with admin bootstrap check
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_email text := lower(trim(new.email));
  v_bootstrap_emails text;
  v_is_bootstrap boolean := false;
  v_has_invite boolean := false;
  v_should_admin boolean := false;
begin
  select value into v_bootstrap_emails from config where key = 'bootstrap_admin_emails';
  if v_bootstrap_emails is not null and length(v_bootstrap_emails) > 0 then
    v_is_bootstrap := exists (
      select 1 from unnest(string_to_array(v_bootstrap_emails, ',')) as email
      where lower(trim(email)) = v_email
    );
  end if;

  v_has_invite := exists (
    select 1 from admin_invites
    where lower(trim(email)) = v_email and consumed_at is null
  );

  v_should_admin := v_is_bootstrap or v_has_invite;

  insert into profiles (id, display_name, timezone, is_admin)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'display_name', 'Friend'),
      'UTC',
      v_should_admin
    );

  if v_has_invite then
    update admin_invites
    set consumed_at = now(), consumed_by = new.id
    where lower(trim(email)) = v_email and consumed_at is null;

    insert into admin_audit (target_user, action, reason)
      values (new.id, 'invited', 'invite consumed on first sign-in');
  end if;

  if v_is_bootstrap then
    insert into admin_audit (target_user, action, reason)
      values (new.id, 'bootstrap_auto', 'email in bootstrap_admin_emails config');
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Restore admin for bootstrap emails on every sign-in (called from client)
create or replace function ensure_bootstrap_admin()
returns void
language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_bootstrap_emails text;
  v_is_bootstrap boolean := false;
  v_currently_admin boolean;
begin
  if v_user_id is null then return; end if;

  select lower(trim(email)) into v_email from auth.users where id = v_user_id;
  select value into v_bootstrap_emails from config where key = 'bootstrap_admin_emails';

  if v_bootstrap_emails is null or length(v_bootstrap_emails) = 0 then return; end if;

  v_is_bootstrap := exists (
    select 1 from unnest(string_to_array(v_bootstrap_emails, ',')) as email
    where lower(trim(email)) = v_email
  );

  if not v_is_bootstrap then return; end if;

  select is_admin into v_currently_admin from profiles where id = v_user_id;

  if not v_currently_admin then
    update profiles set is_admin = true where id = v_user_id;
    insert into admin_audit (target_user, action, reason)
      values (v_user_id, 'promoted', 'bootstrap admin restored on sign-in');
  end if;
end $$;

-- Assign today's prompt to the current user (idempotent)
create or replace function assign_prompt_for_today()
returns daily_assignments
language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_existing daily_assignments;
  v_prompt_id uuid;
begin
  select * into v_existing from daily_assignments
    where user_id = v_user_id and date = v_today;
  if found then return v_existing; end if;

  select id into v_prompt_id from prompts
    where active = true
      and id not in (
        select prompt_id from daily_assignments
          where user_id = v_user_id and date > v_today - interval '30 days'
      )
    order by md5(v_user_id::text || v_today::text || id::text)
    limit 1;

  if v_prompt_id is null then
    select id into v_prompt_id from prompts where active = true
      order by md5(v_user_id::text || v_today::text || id::text) limit 1;
  end if;

  insert into daily_assignments (user_id, date, prompt_id)
    values (v_user_id, v_today, v_prompt_id)
    returning * into v_existing;
  return v_existing;
end $$;
