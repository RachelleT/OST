-- M2 Step 2: submit_post RPC
-- Wraps post upsert + streak calculation + grace day consumption in a single
-- transaction so they can never get out of sync.
--
-- Returns a JSON object with the post row plus grace_used boolean.

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
  v_user_id       uuid    := auth.uid();
  v_timezone      text;
  v_today         date;
  v_yesterday     date;
  v_last_post_date date;
  v_current_streak int;
  v_longest_streak int;
  v_week_start    date;
  v_grace_available boolean;
  v_grace_used    boolean := false;
  v_post          posts;
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

  -- ── 2. Upsert the post ───────────────────────────────────────────
  insert into posts (user_id, prompt_id, date, text, photo_url,
                     share_anonymous, share_with_name, updated_at)
    values (v_user_id, p_prompt_id, v_today,
            nullif(p_text, ''), nullif(p_photo_url, ''),
            p_share_anon, p_share_named, now())
    on conflict (user_id, date) do update
      set text           = excluded.text,
          photo_url      = excluded.photo_url,
          share_anonymous = excluded.share_anonymous,
          share_with_name = excluded.share_with_name,
          updated_at     = now()
    returning * into v_post;

  -- ── 3. Find the last post date before today ───────────────────────
  select date into v_last_post_date
    from posts
   where user_id = v_user_id
     and date < v_today
   order by date desc
   limit 1;

  -- ── 4. Streak logic ───────────────────────────────────────────────
  if v_last_post_date is null then
    -- First ever post
    v_current_streak := 1;

  elsif v_last_post_date = v_yesterday then
    -- Consecutive day — streak continues
    v_current_streak := v_current_streak + 1;

  elsif v_last_post_date = v_today then
    -- Editing today's post — streak unchanged
    null;

  else
    -- There is a gap. Check if exactly one day was missed and grace is available.
    declare
      v_gap_days int;
      v_missed_date date;
    begin
      v_gap_days    := v_today - v_last_post_date; -- number of days since last post
      v_missed_date := v_last_post_date + interval '1 day'; -- the first missed day

      -- Week start (Monday) of the missed day, in the user's timezone
      -- PostgreSQL: dow 1=Mon … 7=Sun
      v_week_start := v_missed_date
        - ((extract(isodow from v_missed_date)::int - 1) * interval '1 day');

      -- Grace is available if no row exists for this user+week
      select not exists (
        select 1 from grace_days_used
         where user_id = v_user_id
           and week_start = v_week_start
      ) into v_grace_available;

      if v_gap_days = 2 and v_grace_available then
        -- Exactly one day missed and grace is available → consume it
        insert into grace_days_used (user_id, week_start, used_for_date)
          values (v_user_id, v_week_start, v_missed_date);
        v_current_streak := v_current_streak + 1;
        v_grace_used     := true;
      else
        -- Gap too large or no grace → streak resets
        v_current_streak := 1;
      end if;
    end;
  end if;

  -- ── 5. Update longest streak ─────────────────────────────────────
  if v_current_streak > v_longest_streak then
    v_longest_streak := v_current_streak;
  end if;

  -- ── 6. Persist streak ────────────────────────────────────────────
  update profiles
     set current_streak = v_current_streak,
         longest_streak = v_longest_streak
   where id = v_user_id;

  -- ── 7. Return post + metadata ────────────────────────────────────
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
