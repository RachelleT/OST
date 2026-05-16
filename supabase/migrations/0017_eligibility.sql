-- M4 Step 5: Eligibility logic.
-- featurable_posts view, auto-unfeature trigger, updated feature_post RPC.

-- ── View: featurable_posts ────────────────────────────────────────────────────
-- Single source of truth for "can this post be featured externally?"

create or replace view featurable_posts as
select p.*
from posts p
where p.moderation_status = 'approved'
  and (p.share_anonymous = true or p.share_with_name = true);

-- ── Trigger: auto-unfeature when share permissions or status are revoked ──────

create or replace function auto_unfeature_on_revoke()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only act when a featured post loses its eligibility
  if (old.share_anonymous = true  and new.share_anonymous = false)
  or (old.share_with_name = true  and new.share_with_name = false)
  or (old.moderation_status = 'approved' and new.moderation_status != 'approved')
  then
    update featured_posts
       set unfeatured_at = now()
     where post_id = new.id
       and unfeatured_at is null
       -- re-check with the new row state: is the post still eligible?
       and not (
         new.moderation_status = 'approved'
         and (new.share_anonymous = true or new.share_with_name = true)
       );

    if found then
      insert into admin_audit (target_post, action, reason)
        values (new.id, 'post_unfeatured',
                'auto: share permission revoked or moderation status changed');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists auto_unfeature_trigger on posts;
create trigger auto_unfeature_trigger
  after update on posts
  for each row
  when (
    old.share_anonymous    is distinct from new.share_anonymous
    or old.share_with_name is distinct from new.share_with_name
    or old.moderation_status is distinct from new.moderation_status
  )
  execute function auto_unfeature_on_revoke();

-- ── Updated feature_post RPC (M4: adds moderation check) ─────────────────────
-- Replaces the M3 version via CREATE OR REPLACE.
-- M3's admin UI keeps calling this unchanged; calls now fail with a clear error
-- for held/pending posts until Step 5.5 adds the disabled-button UI polish.

drop function if exists feature_post(uuid, text);

create or replace function feature_post(p_post_id uuid, p_display_mode text)
returns featured_posts
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_admin boolean;
  v_post     posts;
  v_featured featured_posts;
begin
  select is_admin into v_is_admin from profiles where id = v_actor_id;
  if not v_is_admin then raise exception 'not authorized'; end if;

  if p_display_mode not in ('anonymous', 'with_name') then
    raise exception 'display_mode must be anonymous or with_name';
  end if;

  select * into v_post from posts where id = p_post_id;
  if not found then raise exception 'post not found'; end if;

  -- M4: require approved moderation status
  if v_post.moderation_status = 'held' then
    raise exception 'Post is held for moderation review';
  end if;
  if v_post.moderation_status = 'pending' then
    raise exception 'Moderation check is still running';
  end if;
  if v_post.moderation_status != 'approved' then
    raise exception 'Post is not approved (status: %)', v_post.moderation_status;
  end if;

  -- M4: require share permission matching the requested display mode
  if p_display_mode = 'with_name' and not v_post.share_with_name then
    raise exception 'User has not granted with-name share permission';
  end if;
  if p_display_mode = 'anonymous' and not v_post.share_anonymous then
    raise exception 'User has not granted anonymous share permission';
  end if;

  insert into featured_posts (post_id, display_mode, featured_by)
    values (p_post_id, p_display_mode, v_actor_id)
    returning * into v_featured;

  insert into admin_audit (target_post, action, actor)
    values (p_post_id, 'post_featured', v_actor_id);

  return v_featured;
end;
$$;
