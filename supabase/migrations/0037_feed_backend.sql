-- M5 Step 3: Feed backend
-- Reactions table, RLS, get_feed RPC, toggle_reaction RPC

-- ── 3a: Reactions table ─────────────────────────────────────────────────────

create table post_reactions (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references posts(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)   -- one reaction per user per post
);

create index on post_reactions(post_id);
create index on post_reactions(user_id);

-- ── 3b: RLS ─────────────────────────────────────────────────────────────────

alter table post_reactions enable row level security;

-- Anyone authenticated can see reactions on approved public posts
create policy "anyone reads reactions on public posts" on post_reactions
  for select using (
    exists (
      select 1 from posts
      where id    = post_reactions.post_id
        and is_public           = true
        and moderation_status   = 'approved'
    )
  );

-- Authenticated users can react to approved public posts
create policy "users react to public posts" on post_reactions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from posts
      where id    = post_reactions.post_id
        and is_public           = true
        and moderation_status   = 'approved'
    )
  );

-- Users can remove their own reactions
create policy "users remove own reactions" on post_reactions
  for delete using (auth.uid() = user_id);

-- ── 3c: get_feed RPC ────────────────────────────────────────────────────────
-- Cursor-based pagination (created_at) for smooth infinite scroll.
-- Written in LANGUAGE SQL to avoid RETURNS TABLE column-name ambiguity in PL/pgSQL.
-- SECURITY DEFINER bypasses posts RLS so any authenticated user can read public posts.

create or replace function get_feed(
  cursor_created_at timestamptz default null,
  page_size         int         default 20
)
returns table (
  post_id        uuid,
  user_id        uuid,
  post_text      text,
  photo_url      text,
  prompt_text    text,
  post_date      date,
  created_at     timestamptz,
  display_name   text,
  reaction_count int,
  user_reacted   boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id                                                                    as post_id,
    p.user_id                                                               as user_id,
    p.text                                                                  as post_text,
    p.photo_url                                                             as photo_url,
    pr.text                                                                 as prompt_text,
    p.date                                                                  as post_date,
    p.created_at                                                            as created_at,
    case when prof.show_name_on_shared then prof.display_name else null end as display_name,
    coalesce(
      (select count(*)::int from post_reactions r where r.post_id = p.id), 0
    )                                                                       as reaction_count,
    exists (
      select 1 from post_reactions r
       where r.post_id = p.id
         and r.user_id = auth.uid()
    )                                                                       as user_reacted
  from posts     p
  join prompts   pr   on p.prompt_id = pr.id
  join profiles  prof on p.user_id   = prof.id
  where p.is_public         = true
    and p.moderation_status = 'approved'
    and (cursor_created_at is null or p.created_at < cursor_created_at)
  order by p.created_at desc
  limit page_size;
$$;

grant execute on function get_feed(timestamptz, int) to authenticated;

-- ── 3d: toggle_reaction RPC ─────────────────────────────────────────────────
-- Returns true if the reaction was added, false if removed.

create or replace function toggle_reaction(target_post_id uuid)
returns boolean
language plpgsql
security definer as $$
declare
  v_user_id     uuid := auth.uid();
  v_existing_id uuid;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;

  -- Post must be public and approved
  if not exists (
    select 1 from posts
     where id                = target_post_id
       and is_public         = true
       and moderation_status = 'approved'
  ) then
    raise exception 'post is not available for reactions';
  end if;

  select id into v_existing_id
    from post_reactions
   where post_id = target_post_id
     and user_id = v_user_id;

  if found then
    delete from post_reactions where id = v_existing_id;
    return false;
  else
    insert into post_reactions (post_id, user_id) values (target_post_id, v_user_id);
    return true;
  end if;
end $$;

grant execute on function toggle_reaction(uuid) to authenticated;
