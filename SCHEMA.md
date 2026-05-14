# Database Schema

Postgres via Supabase. Use Supabase migrations (`supabase/migrations/*.sql`).

All tables have:
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `created_at` (timestamptz, default `now()`)

## Tables

### `profiles`
Extends `auth.users`. Created on first sign-in via trigger.

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 3 and 30),
  timezone text not null default 'UTC',
  reminder_time time, -- nullable means notifications off
  is_admin boolean not null default false,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  created_at timestamptz not null default now()
);
```

### `prompts`
M1: seeded with the 5 starter prompts via migration. M3: admin UI writes here.

```sql
create table prompts (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(text) between 5 and 200),
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
```

### `daily_assignments`
The prompt assigned to a user on a given date. Generated lazily on first today-screen open of the day.

```sql
create table daily_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  prompt_id uuid not null references prompts(id),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index on daily_assignments(user_id, date desc);
```

### `posts`
One per user per day. Linked to the prompt they were assigned.

```sql
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
  -- at least one of text or photo must be present
  check (text is not null or photo_url is not null),
  -- one post per user per day
  unique (user_id, date)
);

create index on posts(user_id, date desc);
create index on posts(moderation_status) where moderation_status != 'approved';
```

### `grace_days_used`
One row per grace day consumed. Used to compute whether a user has grace available in their current week.

```sql
create table grace_days_used (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  week_start date not null, -- Monday of the week, in user's TZ
  used_for_date date not null, -- the date the grace covers
  created_at timestamptz not null default now(),
  unique (user_id, week_start) -- enforces one per week
);
```

### `moderation_queue`
M4. Auto-flagged + admin-flagged posts.

```sql
create table moderation_queue (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  reason text not null, -- 'auto_text', 'auto_image', 'admin_flag'
  scores jsonb, -- raw moderation API output
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  decision text check (decision in ('approve', 'hide', 'ignore')),
  created_at timestamptz not null default now()
);
```

### `featured_posts`
M3. Admin-curated posts to surface on a public site.

```sql
create table featured_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  display_mode text not null check (display_mode in ('anonymous', 'with_name')),
  featured_by uuid not null references profiles(id),
  featured_at timestamptz not null default now(),
  unfeatured_at timestamptz
);
```

### `push_subscriptions`
M2. Web Push subscriptions.

```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
```

### `config`
Single-row-per-key key/value store for instance-wide settings. M1.

```sql
create table config (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- Seed with the bootstrap admin email list (empty until user fills it in via SQL Editor)
insert into config (key, value) values ('bootstrap_admin_emails', '');
```

The `bootstrap_admin_emails` value is a comma-separated list of email addresses (case-insensitive, whitespace-trimmed). Any user whose `auth.email()` matches a value in this list will be promoted to admin on every sign-in, regardless of their current `is_admin` flag. This is the "always-on" escape hatch.

### `admin_invites`
M3. Pre-authorized email addresses that get auto-promoted to admin on next sign-in.

```sql
create table admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  invited_by uuid not null references profiles(id),
  invited_at timestamptz not null default now(),
  consumed_at timestamptz, -- set when the invitee signs in and gets promoted
  consumed_by uuid references profiles(id) -- their profile id once promoted
);

create index on admin_invites(email) where consumed_at is null;
```

Unlike bootstrap emails (which are always-on), `admin_invites` are one-time: once consumed, they don't re-promote on future sign-ins. If you want someone to be permanent admin even if demoted, add them to the bootstrap list.

### `admin_audit`
M3. Every admin promotion/demotion logged here.

```sql
create table admin_audit (
  id uuid primary key default gen_random_uuid(),
  target_user uuid not null references profiles(id),
  action text not null check (action in ('promoted', 'demoted', 'invited', 'bootstrap_auto')),
  actor uuid references profiles(id), -- null for bootstrap_auto
  reason text, -- optional, e.g. "bootstrap list", "invited by X"
  created_at timestamptz not null default now()
);

create index on admin_audit(target_user, created_at desc);
```

## Row Level Security

**Enable RLS on every table.** Default to deny.

### `profiles`
- Anyone authenticated can `select` their own row
- Users can `update` their own row (except `is_admin` — only service role)
- Admins can `select` all profiles

```sql
alter table profiles enable row level security;

create policy "users read own profile" on profiles
  for select using (auth.uid() = id);

create policy "users update own profile" on profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- can't set yourself to admin
    and is_admin = (select is_admin from profiles where id = auth.uid())
  );

create policy "admins read all profiles" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
```

### `prompts`
- Anyone authenticated can `select` active prompts
- Only admins can insert/update/delete

```sql
alter table prompts enable row level security;

create policy "anyone reads active prompts" on prompts
  for select using (active = true or
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "admins write prompts" on prompts
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
```

### `daily_assignments`
- Users can read their own assignments
- Inserts happen via a server-side function (RPC) that does the random selection

```sql
alter table daily_assignments enable row level security;

create policy "users read own assignments" on daily_assignments
  for select using (auth.uid() = user_id);

-- writes only via service role / RPC
```

### `posts`
- Users can read and write their own posts
- Admins can read all posts
- Updates allowed only within 5 minutes of creation (enforced at app layer + check)

```sql
alter table posts enable row level security;

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
```

### `grace_days_used`
- Users read own
- Writes only via server function

### `moderation_queue`, `featured_posts`
- Admin read/write only

### `push_subscriptions`
- Users read/write own

### `config`
- Anyone authenticated can read (the bootstrap check needs it)
- Only admins can write

```sql
alter table config enable row level security;

create policy "anyone reads config" on config
  for select using (auth.role() = 'authenticated');

create policy "admins write config" on config
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
```

### `admin_invites`
- Admins read/write
- Service role (trigger) can read for the bootstrap check

```sql
alter table admin_invites enable row level security;

create policy "admins manage invites" on admin_invites
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
```

### `admin_audit`
- Admins read
- Writes only via security-definer functions

```sql
alter table admin_audit enable row level security;

create policy "admins read audit" on admin_audit
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
```

## Storage buckets

Create one bucket: `post-photos`.

- Public read: NO. Photos are served via signed URLs.
- Authenticated upload: YES, but only into `{user_id}/{post_id}.jpg` path
- Max file size: 5MB
- Allowed MIME: image/jpeg, image/png, image/webp

Storage policy:
```sql
create policy "users upload own photos" on storage.objects
  for insert with check (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users read own photos" on storage.objects
  for select using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

Admins additionally can read all photos (separate policy mirroring above with the admin check).

## Helper functions / RPC

### `assign_prompt_for_today()`
Called by the today screen. Idempotent — returns existing assignment if one exists, otherwise creates one.

```sql
create or replace function assign_prompt_for_today()
returns daily_assignments
language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date; -- TODO: use user TZ
  v_existing daily_assignments;
  v_prompt_id uuid;
begin
  -- already have one?
  select * into v_existing from daily_assignments
    where user_id = v_user_id and date = v_today;
  if found then return v_existing; end if;

  -- pick a prompt: prefer ones not shown in last 30 days
  select id into v_prompt_id from prompts
    where active = true
      and id not in (
        select prompt_id from daily_assignments
          where user_id = v_user_id and date > v_today - interval '30 days'
      )
    order by md5(v_user_id::text || v_today::text || id::text)
    limit 1;

  -- fallback if pool too small
  if v_prompt_id is null then
    select id into v_prompt_id from prompts where active = true
      order by md5(v_user_id::text || v_today::text || id::text) limit 1;
  end if;

  insert into daily_assignments (user_id, date, prompt_id)
    values (v_user_id, v_today, v_prompt_id)
    returning * into v_existing;
  return v_existing;
end $$;
```

### `submit_post(text, photo_url, share_anonymous, share_with_name)`
Wraps post insert + streak update + grace day consumption in a transaction. See PRODUCT.md for the streak rules.

### Trigger: profile auto-create with admin bootstrap

The trigger checks three sources to determine if the new user should be admin:
1. The `bootstrap_admin_emails` config value (always-on, persistent)
2. The `admin_invites` table (one-time consumption, M3 onward)

```sql
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_email text := lower(trim(new.email));
  v_bootstrap_emails text;
  v_is_bootstrap boolean := false;
  v_has_invite boolean := false;
  v_should_admin boolean := false;
begin
  -- Check bootstrap list
  select value into v_bootstrap_emails from config where key = 'bootstrap_admin_emails';
  if v_bootstrap_emails is not null and length(v_bootstrap_emails) > 0 then
    v_is_bootstrap := exists (
      select 1 from unnest(string_to_array(v_bootstrap_emails, ',')) as email
      where lower(trim(email)) = v_email
    );
  end if;

  -- Check pending invite
  v_has_invite := exists (
    select 1 from admin_invites
    where lower(trim(email)) = v_email and consumed_at is null
  );

  v_should_admin := v_is_bootstrap or v_has_invite;

  -- Create the profile row
  insert into profiles (id, display_name, timezone, is_admin)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'display_name', 'Friend'),
      'UTC',
      v_should_admin
    );

  -- Consume the invite if there was one
  if v_has_invite then
    update admin_invites
    set consumed_at = now(), consumed_by = new.id
    where lower(trim(email)) = v_email and consumed_at is null;

    insert into admin_audit (target_user, action, reason)
      values (new.id, 'invited', 'invite consumed on first sign-in');
  end if;

  -- Log bootstrap admin auto-promotion
  if v_is_bootstrap then
    insert into admin_audit (target_user, action, reason)
      values (new.id, 'bootstrap_auto', 'email in bootstrap_admin_emails config');
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

### Function: re-promote bootstrap admins on sign-in

The trigger above only fires on first sign-in (auth.users insert). To keep bootstrap admins "always-on" — restoring their admin if they were demoted — call this function on every sign-in from the client side (or via a separate trigger on `auth.sessions` if you want it server-only).

```sql
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

  if v_bootstrap_emails is null or length(v_bootstrap_emails) = 0 then
    return;
  end if;

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
```

The client calls this once per session, right after the auth state confirms a user is signed in. See M1 Step 2.

### Function: invite admin (M3)

```sql
create or replace function invite_admin(invitee_email text)
returns admin_invites
language plpgsql security definer as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_admin boolean;
  v_invite admin_invites;
begin
  -- only admins can invite
  select is_admin into v_is_admin from profiles where id = v_actor_id;
  if not v_is_admin then
    raise exception 'not authorized';
  end if;

  insert into admin_invites (email, invited_by)
    values (lower(trim(invitee_email)), v_actor_id)
    returning * into v_invite;

  -- If they already have an account, promote them now
  declare v_existing_user_id uuid;
  begin
    select id into v_existing_user_id from auth.users
    where lower(trim(email)) = lower(trim(invitee_email));

    if v_existing_user_id is not null then
      update profiles set is_admin = true where id = v_existing_user_id;
      update admin_invites set consumed_at = now(), consumed_by = v_existing_user_id
        where id = v_invite.id;
      insert into admin_audit (target_user, action, actor, reason)
        values (v_existing_user_id, 'promoted', v_actor_id, 'invited by admin');
    end if;
  end;

  return v_invite;
end $$;
```

### Function: demote admin (M3)

```sql
create or replace function demote_admin(target_id uuid)
returns void
language plpgsql security definer as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_is_admin boolean;
  v_admin_count int;
begin
  select is_admin into v_actor_is_admin from profiles where id = v_actor_id;
  if not v_actor_is_admin then
    raise exception 'not authorized';
  end if;

  -- prevent demoting the last admin
  select count(*) into v_admin_count from profiles where is_admin = true;
  if v_admin_count <= 1 then
    raise exception 'cannot demote the last remaining admin';
  end if;

  update profiles set is_admin = false where id = target_id;
  insert into admin_audit (target_user, action, actor) values (target_id, 'demoted', v_actor_id);
end $$;
```

Note: the "last admin" check is a safety rail, not a security feature. The bootstrap email list is the real escape hatch — if you ever lock yourself out, edit the config row in SQL Editor and sign in again to re-promote.

## Seeds

```sql
-- seed/01_starter_prompts.sql
insert into prompts (text) values
  ('What''s something small that made you smile today?'),
  ('Show me where you are right now.'),
  ('If today was a song, what would it be?'),
  ('What did you learn this week?'),
  ('What are you carrying into next week?');
```

## Admin bootstrap

The first admins (you and your teammate) are auto-promoted on first sign-in based on the `bootstrap_admin_emails` config value. Set it via SQL Editor:

```sql
update config set value = 'you@example.com,teammate@example.com'
where key = 'bootstrap_admin_emails';
```

The list is "always-on": signing in re-promotes anyone in this list, even if previously demoted. To remove permanent admin from someone, update the config value to exclude their email AND demote them via the admin UI (or directly with `update profiles set is_admin = false where id = '...'`).

For non-bootstrap admins (added later via the in-app invite flow in M3), the invite is one-time: once consumed on sign-in, future demotions are persistent.
