-- M4 Step 2: Moderation tables + keyword-based text moderation trigger.
-- No external API — pattern matching for zero cost and zero downtime risk.
-- Posts are never blocked from saving; moderation runs after the insert/update.

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists moderation_queue (
  id           uuid        primary key default gen_random_uuid(),
  post_id      uuid        not null references posts(id) on delete cascade,
  reason       text        not null check (reason in ('auto_text', 'auto_image', 'admin_flag', 'wellbeing')),
  scores       jsonb,
  categories   text[],
  reviewed_by  uuid        references profiles(id),
  reviewed_at  timestamptz,
  decision     text        check (decision in ('approve', 'hide', 'ignore')),
  created_at   timestamptz not null default now()
);

create index if not exists moderation_queue_post_idx
  on moderation_queue(post_id);
create index if not exists moderation_queue_unreviewed_idx
  on moderation_queue(reviewed_at) where reviewed_at is null;
create index if not exists moderation_queue_reason_idx
  on moderation_queue(reason);

create table if not exists moderation_errors (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references posts(id) on delete cascade,
  api        text        not null default 'keyword',
  error      text        not null,
  attempt    int         not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists moderation_errors_post_idx
  on moderation_errors(post_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table moderation_queue enable row level security;
alter table moderation_errors enable row level security;

drop policy if exists "admins manage moderation queue" on moderation_queue;
create policy "admins manage moderation queue" on moderation_queue
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "admins read moderation errors" on moderation_errors;
create policy "admins read moderation errors" on moderation_errors
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ── Text moderation trigger ───────────────────────────────────────────────────
-- Fires AFTER insert/update of text column. Safe: posts row exists for FK refs.
-- Internal UPDATE of moderation_status does NOT re-fire (only 'text' is watched).
--
-- Categories:
--   hate      — explicit slurs and hate phrases
--   sexual    — minors-related or non-consensual; NOT general profanity
--   violence  — graphic violence descriptions
--   wellbeing — self-harm language (awareness only; post is NOT held)

create or replace function moderate_post_text()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text       text;
  v_flagged    text[]  := '{}';
  v_wellbeing  boolean := false;
  v_new_status text;
begin
  -- Skip if text column didn't actually change (e.g. share-toggle update)
  if TG_OP = 'UPDATE' then
    if new.text is not distinct from old.text then
      return null;
    end if;
    -- Never change status of admin-hidden posts
    if old.moderation_status = 'hidden' then
      return null;
    end if;
  end if;

  v_text := coalesce(new.text, '');

  -- Photo-only post: nothing to scan
  if length(trim(v_text)) = 0 then
    update posts set moderation_status = 'approved' where id = new.id;
    return null;
  end if;

  -- ── Hate speech ────────────────────────────────────────────────────────────
  if v_text ~* '\m(n[i1][g9]+[e3]?r|k[i1]k[e3]|sp[i1][cg]k?|f[a4][g9]+[o0]t|wetback|tr[a4]nny|ch[i1]nk|raghead|towelhead)\M'
    or v_text ~* '(white (power|supremac[ay]|nationalists?)|death to (the )?(jews?|blacks?|muslims?|gays?)|go back to (your )?country)'
  then
    v_flagged := array_append(v_flagged, 'hate');
  end if;

  -- ── Sexual / minors ────────────────────────────────────────────────────────
  -- Deliberately narrow: general profanity is fine in a journal, only flag
  -- content involving minors or non-consensual scenarios.
  if v_text ~* '\m(child (porn|pornography|sexual)|underage (sex|nude|naked|porn)|kids? (nude|nudes|naked|sex|porn))\M'
    or v_text ~* '\m(rape (fantasy|fetish|porn)|snuff (porn|film|fantasy))\M'
  then
    v_flagged := array_append(v_flagged, 'sexual');
  end if;

  -- ── Graphic violence ───────────────────────────────────────────────────────
  if v_text ~* '\m(decapitat|disembowel|eviscerat)\M'
    or v_text ~* '(slit (his|her|their|your|my) (throat|wrists?)|blow(ing)? (his|her|their|your|my) brains? out)'
    or v_text ~* '\m(gore (porn|site|video)|snuff film)\M'
  then
    v_flagged := array_append(v_flagged, 'violence');
  end if;

  -- ── Wellbeing / self-harm ──────────────────────────────────────────────────
  -- Post is NOT held — author sees it normally. Admin gets quiet awareness.
  -- No audit log entries for wellbeing (privacy: no permanent record of distress).
  if v_text ~* '(want(ing)? to (kill|end) (my|him|her)self|(end|take) (my|his|her) (own )?life|no reason to (live|be alive)|better off dead|suicid(e|al|ing)|cutting my(self)?|self.?harm(ing)?)'
    or v_text ~* '\m(kms|kill myself|dont want to live|wanna die)\M'
  then
    v_wellbeing := true;
  end if;

  -- ── Set moderation status ──────────────────────────────────────────────────
  v_new_status := case
    when array_length(v_flagged, 1) > 0 then 'held'
    else 'approved'
  end;

  update posts set moderation_status = v_new_status where id = new.id;

  -- Queue row for flagged content (replace on re-moderation after edit)
  if v_new_status = 'held' then
    delete from moderation_queue where post_id = new.id and reason = 'auto_text';
    insert into moderation_queue (post_id, reason, categories, scores)
    values (new.id, 'auto_text', v_flagged, to_jsonb(v_flagged));
  end if;

  -- Wellbeing row: insert once only, never replace
  if v_wellbeing then
    insert into moderation_queue (post_id, reason, categories, scores)
    select new.id, 'wellbeing', array['self-harm'], '[]'::jsonb
    where not exists (
      select 1 from moderation_queue
      where post_id = new.id and reason = 'wellbeing'
    );
  end if;

  return null; -- required for AFTER triggers
end;
$$;

drop trigger if exists moderate_text_trigger on posts;
create trigger moderate_text_trigger
  after insert or update of text
  on posts
  for each row
  execute function moderate_post_text();

-- Backfill: approve all existing posts that are still in 'pending'
-- (these predate M4 and were never auto-moderated)
update posts set moderation_status = 'approved'
where moderation_status = 'pending';
