-- M4 Step 4: Moderation queue RPCs + fix missing columns.
-- moderation_queue was created in 0001 without the categories column — add it.
-- Extend admin_audit action constraint to cover moderation decisions.

-- ── Fix missing column from 0001 ─────────────────────────────────────────────

alter table moderation_queue
  add column if not exists categories text[];

-- ── Extend admin_audit action constraint ──────────────────────────────────────

alter table admin_audit drop constraint if exists admin_audit_action_check;

alter table admin_audit add constraint admin_audit_action_check
  check (action in (
    'promoted', 'demoted', 'invited', 'bootstrap_auto',
    'post_hidden', 'post_unhidden', 'post_featured', 'post_unfeatured',
    'post_approved', 'post_moderation_ignored',
    'prompt_created', 'prompt_edited', 'prompt_deactivated', 'prompt_reactivated',
    'note_created', 'note_edited', 'note_deactivated', 'note_reactivated'
  ));

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- Fetch queue items with joined post + author data.
-- p_filter: 'needs_review' | 'wellbeing' | 'history'
create or replace function get_moderation_queue(p_filter text default 'needs_review')
returns table (
  queue_id     uuid,
  post_id      uuid,
  reason       text,
  categories   text[],
  queued_at    timestamptz,
  reviewed_at  timestamptz,
  decision     text,
  post_text    text,
  photo_url    text,
  post_date    date,
  author_name  text
)
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin = true) then
    raise exception 'not authorized';
  end if;

  return query
  select
    mq.id,
    mq.post_id,
    mq.reason,
    mq.categories,
    mq.created_at,
    mq.reviewed_at,
    mq.decision,
    p.text,
    p.photo_url,
    p.date,
    pr.display_name
  from moderation_queue mq
  join posts    p  on p.id  = mq.post_id
  join profiles pr on pr.id = p.user_id
  where case p_filter
    when 'needs_review' then mq.reason = 'auto_text' and mq.reviewed_at is null
    when 'wellbeing'    then mq.reason = 'wellbeing'
    when 'history'      then mq.reviewed_at is not null
    else true
  end
  order by mq.created_at desc
  limit 100;
end;
$$;

-- Count of unreviewed auto_text items for the nav badge.
create or replace function get_moderation_queue_count()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin = true) then
    return 0;
  end if;
  select count(*) into v_count
  from moderation_queue
  where reason = 'auto_text' and reviewed_at is null;
  return v_count;
end;
$$;

-- Approve a held post from the queue.
create or replace function approve_moderation(p_queue_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_admin boolean;
  v_post_id  uuid;
begin
  select is_admin into v_is_admin from profiles where id = v_actor_id;
  if not v_is_admin then raise exception 'not authorized'; end if;

  select post_id into v_post_id from moderation_queue where id = p_queue_id;
  if not found then raise exception 'queue item not found'; end if;

  update posts set moderation_status = 'approved' where id = v_post_id;

  update moderation_queue
    set reviewed_by = v_actor_id, reviewed_at = now(), decision = 'approve'
    where id = p_queue_id;

  insert into admin_audit (target_post, action, actor)
    values (v_post_id, 'post_approved', v_actor_id);
end;
$$;

-- Mark queue item as a false positive. Post becomes featurable; queue row kept for analytics.
create or replace function ignore_moderation(p_queue_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_admin boolean;
  v_post_id  uuid;
begin
  select is_admin into v_is_admin from profiles where id = v_actor_id;
  if not v_is_admin then raise exception 'not authorized'; end if;

  select post_id into v_post_id from moderation_queue where id = p_queue_id;
  if not found then raise exception 'queue item not found'; end if;

  update posts set moderation_status = 'approved' where id = v_post_id;

  update moderation_queue
    set reviewed_by = v_actor_id, reviewed_at = now(), decision = 'ignore'
    where id = p_queue_id;

  insert into admin_audit (target_post, action, actor)
    values (v_post_id, 'post_moderation_ignored', v_actor_id);
end;
$$;

-- Hide a post from the moderation queue (marks queue row reviewed too).
create or replace function hide_from_moderation(p_queue_id uuid, p_reason text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_admin boolean;
  v_post_id  uuid;
begin
  select is_admin into v_is_admin from profiles where id = v_actor_id;
  if not v_is_admin then raise exception 'not authorized'; end if;

  select post_id into v_post_id from moderation_queue where id = p_queue_id;
  if not found then raise exception 'queue item not found'; end if;

  update posts set moderation_status = 'hidden' where id = v_post_id;

  update moderation_queue
    set reviewed_by = v_actor_id, reviewed_at = now(), decision = 'hide'
    where id = p_queue_id;

  insert into admin_audit (target_post, action, actor, reason)
    values (v_post_id, 'post_hidden', v_actor_id, p_reason);
end;
$$;
