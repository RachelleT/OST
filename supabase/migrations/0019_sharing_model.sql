-- M4 sharing model update.
-- All approved posts are featurable by default.
-- share_anonymous is now always true (anonymous featuring is always allowed).
-- share_with_name is the only user preference: opt-in to named display.

-- ── 1. Default share_anonymous to true ───────────────────────────────────────

alter table posts alter column share_anonymous set default true;

-- Backfill: all existing posts can be featured anonymously
update posts set share_anonymous = true where share_anonymous = false;

-- ── 2. Updated featurable_posts view ─────────────────────────────────────────
-- Approved posts are featurable regardless of share flags.

create or replace view featurable_posts as
select p.*
from posts p
where p.moderation_status = 'approved';

-- ── 3. Updated feature_post RPC ───────────────────────────────────────────────
-- Anonymous display is always allowed for approved posts.
-- With-name display still requires user opt-in (share_with_name = true).

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

  if v_post.moderation_status = 'held' then
    raise exception 'Post is held for moderation review';
  end if;
  if v_post.moderation_status = 'pending' then
    raise exception 'Moderation check is still running';
  end if;
  if v_post.moderation_status != 'approved' then
    raise exception 'Post is not approved (status: %)', v_post.moderation_status;
  end if;

  -- With-name still requires explicit user opt-in
  if p_display_mode = 'with_name' and not v_post.share_with_name then
    raise exception 'User has not opted in to named display';
  end if;

  insert into featured_posts (post_id, display_mode, featured_by)
    values (p_post_id, p_display_mode, v_actor_id)
    returning * into v_featured;

  insert into admin_audit (target_post, action, actor)
    values (p_post_id, 'post_featured', v_actor_id);

  return v_featured;
end;
$$;

-- ── 4. Updated auto-unfeature trigger ────────────────────────────────────────
-- Now only unfeatured when moderation_status changes away from 'approved'.
-- share_anonymous changes no longer trigger unfeaturing (always true now).
-- share_with_name changes don't unfeature either — display mode is set at
-- feature time; the admin can unfeature manually if the user revokes name consent.

create or replace function auto_unfeature_on_revoke()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.moderation_status = 'approved' and new.moderation_status != 'approved' then
    update featured_posts
       set unfeatured_at = now()
     where post_id = new.id
       and unfeatured_at is null;

    if found then
      insert into admin_audit (target_post, action, reason)
        values (new.id, 'post_unfeatured',
                'auto: moderation status changed from approved');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists auto_unfeature_trigger on posts;
create trigger auto_unfeature_trigger
  after update on posts
  for each row
  when (old.moderation_status is distinct from new.moderation_status)
  execute function auto_unfeature_on_revoke();
