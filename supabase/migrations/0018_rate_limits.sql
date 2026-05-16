-- M4 Step 6: Rate limits and abuse prevention.
--
-- 1. Edit-rate guard: max 10 updates to a post within any 5-minute window.
--    Enforced inside submit_post — two new columns track the window.
-- 2. Photo-upload rate: max 3 uploads per user per day, enforced in storage RLS.

-- ── 1. Edit-rate columns ──────────────────────────────────────────────────────

alter table posts
  add column if not exists edit_count        int          not null default 0,
  add column if not exists edit_window_start timestamptz;

-- ── 2. Updated submit_post (adds edit-rate check on update path) ─────────────

create or replace function submit_post(
  p_prompt_id      uuid,
  p_text           text,
  p_photo_url      text,
  p_share_anon     boolean default false,
  p_share_named    boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id        uuid    := auth.uid();
  v_timezone       text;
  v_today          date;
  v_yesterday      date;
  v_last_post_date date;
  v_current_streak int;
  v_longest_streak int;
  v_week_start     date;
  v_grace_available boolean;
  v_grace_used     boolean := false;
  v_post           posts;
  v_existing       posts;
  v_new_count      int;
  v_new_window     timestamptz;
begin
  -- ── 1. User context ──────────────────────────────────────────────
  select coalesce(nullif(timezone, ''), 'UTC'),
         current_streak,
         longest_streak
    into v_timezone, v_current_streak, v_longest_streak
    from profiles
   where id = v_user_id;

  v_today     := (current_timestamp at time zone v_timezone)::date;
  v_yesterday := v_today - interval '1 day';

  -- ── 2. Edit-rate check (only on update path) ──────────────────────
  select * into v_existing
    from posts
   where user_id = v_user_id
     and date = v_today;

  if found then
    -- Existing post today → this is an edit
    if v_existing.edit_window_start is not null
       and now() - v_existing.edit_window_start < interval '5 minutes' then
      -- Still in the current window
      v_new_count  := v_existing.edit_count + 1;
      v_new_window := v_existing.edit_window_start;
    else
      -- Window expired or never set → open a fresh window
      v_new_count  := 1;
      v_new_window := now();
    end if;

    if v_new_count > 10 then
      raise exception 'Too many edits — please wait a moment before saving again';
    end if;
  else
    -- First submission today
    v_new_count  := 0;
    v_new_window := null;
  end if;

  -- ── 3. Upsert the post ───────────────────────────────────────────
  insert into posts (user_id, prompt_id, date, text, photo_url,
                     share_anonymous, share_with_name,
                     edit_count, edit_window_start, updated_at)
    values (v_user_id, p_prompt_id, v_today,
            nullif(p_text, ''), nullif(p_photo_url, ''),
            p_share_anon, p_share_named,
            v_new_count, v_new_window, now())
    on conflict (user_id, date) do update
      set text             = excluded.text,
          photo_url        = excluded.photo_url,
          share_anonymous  = excluded.share_anonymous,
          share_with_name  = excluded.share_with_name,
          edit_count       = excluded.edit_count,
          edit_window_start = excluded.edit_window_start,
          updated_at       = now()
    returning * into v_post;

  -- ── 4. Find the last post date before today ───────────────────────
  select date into v_last_post_date
    from posts
   where user_id = v_user_id
     and date < v_today
   order by date desc
   limit 1;

  -- ── 5. Streak logic ───────────────────────────────────────────────
  if v_last_post_date is null then
    v_current_streak := 1;

  elsif v_last_post_date = v_yesterday then
    v_current_streak := v_current_streak + 1;

  elsif v_last_post_date = v_today then
    null; -- editing today's post, streak unchanged

  else
    declare
      v_gap_days  int;
      v_missed_date date;
    begin
      v_gap_days    := v_today - v_last_post_date;
      v_missed_date := v_last_post_date + interval '1 day';

      v_week_start := v_missed_date
        - ((extract(isodow from v_missed_date)::int - 1) * interval '1 day');

      select not exists (
        select 1 from grace_days_used
         where user_id = v_user_id
           and week_start = v_week_start
      ) into v_grace_available;

      if v_gap_days = 2 and v_grace_available then
        insert into grace_days_used (user_id, week_start, used_for_date)
          values (v_user_id, v_week_start, v_missed_date);
        v_current_streak := v_current_streak + 1;
        v_grace_used     := true;
      else
        v_current_streak := 1;
      end if;
    end;
  end if;

  -- ── 6. Update longest streak ──────────────────────────────────────
  if v_current_streak > v_longest_streak then
    v_longest_streak := v_current_streak;
  end if;

  -- ── 7. Persist streak ─────────────────────────────────────────────
  update profiles
     set current_streak = v_current_streak,
         longest_streak = v_longest_streak
   where id = v_user_id;

  -- ── 8. Return post + metadata ──────────────────────────────────────
  return jsonb_build_object(
    'id',             v_post.id,
    'user_id',        v_post.user_id,
    'prompt_id',      v_post.prompt_id,
    'date',           v_post.date,
    'text',           v_post.text,
    'photo_url',      v_post.photo_url,
    'created_at',     v_post.created_at,
    'updated_at',     v_post.updated_at,
    'current_streak', v_current_streak,
    'longest_streak', v_longest_streak,
    'grace_used',     v_grace_used
  );
end $$;

-- ── 3. Photo-upload rate: max 3 per user per day ──────────────────────────────
-- Called from the storage INSERT policy for the posts bucket.
-- Counts objects already uploaded today under the caller's user_id prefix.

create or replace function check_photo_upload_allowed()
returns boolean
language sql stable security definer
set search_path = public, storage
as $$
  select count(*) < 3
    from storage.objects
   where bucket_id = 'posts'
     and owner    = auth.uid()
     and created_at >= current_date::timestamptz
     and created_at <  (current_date + 1)::timestamptz;
$$;

-- Update the storage INSERT policy to enforce the cap.
-- Drop the existing policy first so we can replace it.
drop policy if exists "Users can upload their own post photos" on storage.objects;

create policy "Users can upload their own post photos"
  on storage.objects for insert
  with check (
    bucket_id = 'posts'
    and auth.uid()::text = (storage.foldername(name))[1]
    and check_photo_upload_allowed()
  );
