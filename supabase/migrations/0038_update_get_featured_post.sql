-- M5 Step 7: Update get_featured_post for the new sharing model
--
-- Changes:
-- 1. Add photo_url to the return type
-- 2. Check is_public = true (if user revokes public status, page shows "gone")
-- 3. author_name now requires BOTH display_mode = 'with_name'
--    AND profiles.show_name_on_shared = true (live check, not frozen at feature time)
-- 4. Fix feature_post to unfeature any existing row before inserting (was missing after M5 Step 2 rewrite)

-- Drop old signature so we can change return type
drop function if exists get_featured_post(uuid);

create or replace function get_featured_post(p_post_id uuid)
returns table(
  post_id      uuid,
  post_text    text,
  photo_url    text,
  prompt_text  text,
  post_date    text,
  display_mode text,
  author_name  text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    fp.post_id,
    p.text                                                                as post_text,
    p.photo_url                                                           as photo_url,
    pr.text                                                               as prompt_text,
    p.date::text                                                          as post_date,
    fp.display_mode,
    case
      when fp.display_mode = 'with_name'
       and prof.show_name_on_shared = true
      then prof.display_name
      else null
    end                                                                   as author_name
  from featured_posts fp
  join posts    p    on p.id    = fp.post_id
  join prompts  pr   on pr.id   = p.prompt_id
  join profiles prof on prof.id = p.user_id
  where fp.post_id        = p_post_id
    and fp.unfeatured_at  is null
    and p.moderation_status != 'hidden'
    and p.is_public         = true
  limit 1;
$$;

grant execute on function get_featured_post(uuid) to anon, authenticated;

-- Fix feature_post: unfeature any existing active row before inserting
-- (the Step 2 rewrite dropped this step accidentally)
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

  -- Unfeature any currently active row first (idempotent re-feature)
  update featured_posts
     set unfeatured_at = now()
   where post_id = p_post_id and unfeatured_at is null;

  insert into featured_posts (post_id, display_mode, featured_by)
    values (p_post_id, p_display_mode, v_actor_id)
    returning * into v_featured;

  insert into admin_audit (target_post, action, actor)
    values (p_post_id, 'post_featured', v_actor_id);

  return v_featured;
end $$;
