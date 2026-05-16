-- M3 Step 4: feature_post, unfeature_post, and get_featured_post RPCs.
-- Also adds public read policy so /p/:id works without auth.

-- ── Feature/unfeature ─────────────────────────────────────────────────────────

create or replace function feature_post(p_post_id uuid, p_display_mode text)
returns void
language plpgsql security definer as $$
declare
  v_actor    uuid := auth.uid();
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  -- Unfeature any currently active featured row first (idempotent re-feature)
  update featured_posts
    set unfeatured_at = now()
    where post_id = p_post_id and unfeatured_at is null;

  insert into featured_posts (post_id, display_mode, featured_by)
    values (p_post_id, p_display_mode, v_actor);

  insert into admin_audit (target_post, action, actor)
    values (p_post_id, 'post_featured', v_actor);
end $$;

create or replace function unfeature_post(p_post_id uuid)
returns void
language plpgsql security definer as $$
declare
  v_actor    uuid := auth.uid();
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  update featured_posts
    set unfeatured_at = now()
    where post_id = p_post_id and unfeatured_at is null;

  insert into admin_audit (target_post, action, actor)
    values (p_post_id, 'post_unfeatured', v_actor);
end $$;

-- ── Public read helper ────────────────────────────────────────────────────────
-- Called by /p/:id without auth — security definer bypasses RLS.

create or replace function get_featured_post(p_post_id uuid)
returns table(
  post_id      uuid,
  post_text    text,
  prompt_text  text,
  post_date    text,
  display_mode text,
  author_name  text
)
language plpgsql security definer as $$
begin
  return query
    select
      fp.post_id,
      p.text                                                              as post_text,
      pr.text                                                             as prompt_text,
      p.date::text                                                        as post_date,
      fp.display_mode,
      case when fp.display_mode = 'with_name' then prof.display_name
           else null
      end                                                                 as author_name
    from featured_posts fp
    join posts    p    on p.id  = fp.post_id
    join prompts  pr   on pr.id = p.prompt_id
    join profiles prof on prof.id = p.user_id
    where fp.post_id     = p_post_id
      and fp.unfeatured_at is null
      and p.moderation_status != 'hidden'
    limit 1;
end $$;

-- Allow anyone to call these (auth is checked inside the security-definer body)
grant execute on function feature_post(uuid, text)  to anon, authenticated;
grant execute on function unfeature_post(uuid)       to anon, authenticated;
grant execute on function get_featured_post(uuid)    to anon, authenticated;
