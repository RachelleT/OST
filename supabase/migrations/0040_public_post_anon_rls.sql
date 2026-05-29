-- Allow anonymous (unauthenticated) users to read the data needed
-- for the /p/:id public post page, so we can query directly from
-- the client instead of relying on a security-definer RPC.

-- ── featured_posts ───────────────────────────────────────────────────────────
-- Enable RLS if not already on; add anon read policy for active features.

alter table featured_posts enable row level security;

create policy "anon can read active featured posts" on featured_posts
  for select to anon
  using (unfeatured_at is null);

-- Authenticated users should still be able to read their own featured posts
-- (needed by admin screens — they use security-definer RPCs, but just in case)
create policy "authenticated can read featured posts" on featured_posts
  for select to authenticated
  using (true);

-- ── posts ─────────────────────────────────────────────────────────────────────
-- Allow anon to read posts that are currently featured, public, and approved.

create policy "anon can read featured public posts" on posts
  for select to anon
  using (
    is_public = true
    and moderation_status = 'approved'
    and exists (
      select 1 from featured_posts fp
      where fp.post_id = posts.id
        and fp.unfeatured_at is null
    )
  );

-- ── profiles ──────────────────────────────────────────────────────────────────
-- Allow anon to read display_name + show_name_on_shared for featured post authors.

create policy "anon can read featured post author profiles" on profiles
  for select to anon
  using (
    exists (
      select 1 from posts p
      join featured_posts fp on fp.post_id = p.id
      where p.user_id    = profiles.id
        and p.is_public  = true
        and p.moderation_status = 'approved'
        and fp.unfeatured_at    is null
    )
  );

-- ── prompts ───────────────────────────────────────────────────────────────────
-- Prompts are generic questions — allow anon to read them.
-- (Enable RLS first in case it wasn't on; add a permissive anon policy.)

alter table prompts enable row level security;

create policy "anon can read prompts" on prompts
  for select to anon
  using (true);

create policy "authenticated can read prompts" on prompts
  for select to authenticated
  using (true);

notify pgrst, 'reload schema';
