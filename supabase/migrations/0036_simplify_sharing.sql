-- M5 Step 2: Simplify the sharing model
--
-- Old model: two per-post booleans (share_anonymous, share_with_name)
-- New model: one per-post boolean (is_public) + one per-profile boolean (show_name_on_shared)
--
-- All existing posts stay private (is_public = false) — they were written
-- under a different model and should not be retroactively exposed.

-- ── 1. Add new columns ──────────────────────────────────────────────────────

alter table posts     add column is_public          boolean not null default false;
alter table profiles  add column show_name_on_shared boolean not null default false;

-- ── 2. Drop the old view (it depends on the columns we're dropping) ─────────

drop view if exists featurable_posts;

-- ── 3. Drop the old columns ─────────────────────────────────────────────────

alter table posts drop column share_anonymous;
alter table posts drop column share_with_name;

-- ── 4. Recreate featurable_posts with the new model ─────────────────────────

create view featurable_posts as
  select p.*
  from posts p
  where p.moderation_status = 'approved'
    and p.is_public = true;

-- ── 5. Update feature_post RPC ──────────────────────────────────────────────
-- Admins can only feature posts the user has made public.
-- The 'with_name' display mode additionally requires show_name_on_shared.

create or replace function feature_post(p_post_id uuid, p_display_mode text)
returns featured_posts
language plpgsql security definer as $$
declare
  v_actor_id  uuid := auth.uid();
  v_is_admin  boolean;
  v_post      posts;
  v_featured  featured_posts;
  v_show_name boolean;
begin
  select is_admin into v_is_admin from profiles where id = v_actor_id;
  if not v_is_admin then raise exception 'not authorized'; end if;

  if p_display_mode not in ('anonymous', 'with_name') then
    raise exception 'display_mode must be anonymous or with_name';
  end if;

  select * into v_post from posts where id = p_post_id;
  if not found then raise exception 'post not found'; end if;

  if v_post.moderation_status != 'approved' then
    raise exception 'post is not approved (status: %)', v_post.moderation_status;
  end if;

  if not v_post.is_public then
    raise exception 'user has not made this post public';
  end if;

  if p_display_mode = 'with_name' then
    select show_name_on_shared into v_show_name from profiles where id = v_post.user_id;
    if not v_show_name then
      raise exception 'user has not enabled show-name-on-shared';
    end if;
  end if;

  insert into featured_posts (post_id, display_mode, featured_by)
    values (p_post_id, p_display_mode, v_actor_id)
    returning * into v_featured;

  insert into admin_audit (target_post, action, actor)
    values (p_post_id, 'post_featured', v_actor_id);

  return v_featured;
end $$;

-- ── 6. Update submit_post RPC ───────────────────────────────────────────────
-- Remove p_share_anon / p_share_named; add p_is_public.
-- Note: PostgreSQL can't change param names via CREATE OR REPLACE when they
-- differ, so we drop and recreate.

drop function if exists submit_post(uuid, text, text, boolean, boolean);

create function submit_post(
  p_prompt_id  uuid,
  p_text       text,
  p_photo_url  text,
  p_is_public  boolean default false
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
begin
  -- 1. User context
  select coalesce(nullif(timezone, ''), 'UTC'),
         current_streak,
         longest_streak
    into v_timezone, v_current_streak, v_longest_streak
    from profiles
   where id = v_user_id;

  v_today     := (current_timestamp at time zone v_timezone)::date;
  v_yesterday := v_today - interval '1 day';

  -- 2. Upsert the post
  insert into posts (user_id, prompt_id, date, text, photo_url, is_public, updated_at)
    values (v_user_id, p_prompt_id, v_today,
            nullif(p_text, ''), nullif(p_photo_url, ''),
            p_is_public, now())
    on conflict (user_id, date) do update
      set text       = excluded.text,
          photo_url  = excluded.photo_url,
          is_public  = excluded.is_public,
          updated_at = now()
    returning * into v_post;

  -- 3. Find the last post date before today
  select date into v_last_post_date
    from posts
   where user_id = v_user_id
     and date < v_today
   order by date desc
   limit 1;

  -- 4. Streak logic
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
      v_week_start  := v_missed_date
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

  -- 5. Update longest streak
  if v_current_streak > v_longest_streak then
    v_longest_streak := v_current_streak;
  end if;

  -- 6. Persist streak
  update profiles
     set current_streak = v_current_streak,
         longest_streak = v_longest_streak
   where id = v_user_id;

  -- 7. Return
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

grant execute on function submit_post(uuid, text, text, boolean) to authenticated;
