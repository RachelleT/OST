# Milestone 5 — Rename, Feed, and Public Surfaces

Goal: rename the app to **Dayspark by Yuvoice**, add a fourth nav tab (Feed) showing posts users have chosen to share, simplify the sharing model into a single per-post toggle plus one global identity setting, and polish the public-facing surfaces (`/p/{id}` page, og:image generation, homepage, SEO).

After M5, the app:
- Is rebranded as Dayspark
- Has a community surface (Feed) inside the app where users can opt to share their posts
- Has proper share previews on social and messaging platforms
- Has a real landing page for unauthenticated visitors

Prerequisite: M1, M2, M2.1, M3, M4 complete. M4's validation period passed.

---

## Three big changes in M5

These all interact and are best understood together before reading the steps:

### 1. Rename: OST → Dayspark by Yuvoice

"Dayspark" is the product name. "Yuvoice" is the company/brand. Display ordering: "Dayspark" in app, "Dayspark by Yuvoice" in legal/about contexts, "© Yuvoice" in footer.

Touchpoints: app metadata, PWA manifest, splash screen, sign-in screen, all email templates (magic link, etc.), homepage, footer, og:tags, README/docs in the repo.

### Domain: `dayspark.yuvoice.com` (live in Step 13)

Dayspark will live on a subdomain of the existing Yuvoice domain. `yuvoice.com` (currently hosting the Yuvoice WordPress site via Hostinger) stays untouched at the apex; the new subdomain is a separate CNAME at NetNation pointing at Vercel.

**Timing**: the domain switchover is the *last* step of M5 (Step 13). All earlier M5 work runs on the existing Vercel-default URL. The point: don't burn time debugging a domain change while there's still product work to ship; do it all at once, as a deliberate "promote to production" moment.

Use the `VITE_PUBLIC_BASE_URL` environment variable wherever absolute URLs are emitted (og tags, share images, sitemap). Initially set to the Vercel-default URL; switched to `https://dayspark.yuvoice.com` in Step 13. Don't hardcode the domain anywhere.

### 2. The Feed

A fourth nav tab where users see posts other users have shared. Chronological, infinite scroll, all-time. Read-only with single-emoji reactions.

Critical: **a post only appears on the Feed if the author actively opted in.** No retroactive inclusion of existing posts. The Feed is opt-in, never opt-out.

### 3. Simplified sharing model

The old model had two per-post toggles (`share_anonymous`, `share_with_name`). M5 collapses these to:

- **Per-post**: a single boolean `is_public` (default `false`)
- **Per-user**: a global account setting `show_name_on_shared` (default `false`)

When `is_public = true`:
- The post appears on the Feed
- The post is admin-eligible for external featuring (homepage cards, og:images, `/p/{id}`)

When `show_name_on_shared = true`:
- Anywhere a shared post is displayed (Feed, `/p/{id}`, og:image, homepage), the author's display name appears
- When `false`, the post is shown without attribution (no "— anonymous" label — just the words, no byline at all)

This is one toggle for "do I want this out there" and one setting for "do I want my name on it." Two concepts, two controls.

### Migration rules

- New column `posts.is_public` (boolean, not null, default false)
- New column `profiles.show_name_on_shared` (boolean, not null, default false)
- All existing posts: `is_public = false`. Existing posts stay private regardless of the old `share_anonymous` value — users wrote them under different assumptions.
- The old columns `share_anonymous` and `share_with_name` are dropped after the migration. Any code still reading them gets fixed during M5.
- The `featurable_posts` view becomes: `where moderation_status = 'approved' and is_public = true`
- The `feature_post()` RPC updates accordingly — no more two-toggle logic; the post is either public or it isn't, the only admin choice is whether to feature it externally (which they already control)

---

## Grounding in what M4 actually shipped

A few things from M4-as-built shape M5:

1. **Text moderation is keyword/regex based, in a Postgres trigger.** Fast, no external API. This makes "post hits Feed after passing moderation" feel instant from the user's perspective — the trigger completes synchronously on insert.
2. **No automated image moderation.** Photos are never classifier-screened. For the Feed and for og:image generation, this matters: photos that haven't been seen by an admin can still appear publicly via the Feed. The mitigation in M5: a flag in the admin Moderation screen for "newly-shared-public posts with photos" so the team can scan recent additions.
3. **Sharing was previously `share_anonymous = true` for all approved posts, `share_with_name = false`.** This made everything anonymously-shareable, which conflicts with the new opt-in Feed model. M5 corrects this with `is_public = false` as the default for all existing posts.

---

## Build order

Steps are ordered to ship value progressively. After each step, the app is in a coherent state — you don't need to finish M5 to ship parts of it.

All steps except the last work on the existing Vercel-default URL. The custom domain switch happens at the very end, as a deliberate "flip to production" ceremony.

1. **Rename in code** — text, manifests, copy. App rebranded as Dayspark in the codebase.
2. **Migration: simplify sharing model** — schema change before any feature builds on it
3. **Feed: backend** — the queries, RLS, reactions table
4. **Feed: UI** — the new tab, the post cards, reactions
5. **Composer: single share toggle** — replaces the two-toggle UI in the composer
6. **Settings: show-name-on-shared toggle** — the global identity setting
7. **Polish `/p/{id}` page** — public-page design
8. **og:image generation** — server-side previews
9. **Homepage** — landing page at the root URL
10. **SEO basics + cache invalidation**
11. **Privacy/terms/contact pages**
12. **Pre-launch checklist (on the Vercel-default URL)**
13. **Production domain switchover** — the very last step. Vercel custom domain, NetNation CNAME, Supabase URL update. Everything that needs `dayspark.yuvoice.com` is done together as a single deploy moment.

---

## Step 1 — Rename in code

Pure code changes. No Vercel, Supabase, or DNS work in this step — that's all consolidated in Step 13 (the production domain switchover).

While building M5, the app continues to run on the existing Vercel-default URL. Magic-link sign-in keeps working with the existing Supabase URL Configuration. Visible app text changes from "One Small Thing" / "OST" to "Dayspark" — but the URL doesn't change yet.

### Code changes

- Update `package.json` `name` field to `dayspark`
- Update `index.html` `<title>` to "Dayspark"
- Update PWA manifest in `vite.config.ts`:
  - `name`: "Dayspark"
  - `short_name`: "Dayspark"
  - `description`: "One prompt a day. Build something quiet."
- Find-and-replace any visible app name in components: SignIn screen, splash, onboarding, About sections
- Update the wordmark — for v1, set typography (a clean sans, slight letter-spacing) as the wordmark; a real logo can come later
- Update README, all docs, all .md files in the repo to use "Dayspark by Yuvoice"
- **Don't** rename any folders or paths in the repo at this point — just text content
- **Don't** touch Vercel project settings, Supabase URL Configuration, or DNS yet — all that happens in Step 13

### Add a production base URL env var

This sets up Step 8 (og:image generation) to work cleanly across both the current Vercel-default URL and the eventual `dayspark.yuvoice.com`.

- Add `VITE_PUBLIC_BASE_URL` to `.env.example`. In `.env.local`, set it to the current Vercel-default URL for now (e.g. `https://your-project.vercel.app`)
- Wherever the app needs to emit an absolute URL (og tags, share images, sitemap, magic-link callback URLs in client code), read it from `import.meta.env.VITE_PUBLIC_BASE_URL`
- Don't hardcode `dayspark.yuvoice.com` anywhere — that domain only goes live in Step 13. The env var becomes `https://dayspark.yuvoice.com` at deploy time when the custom domain is added.
- In Vercel project settings → Environment Variables, set `VITE_PUBLIC_BASE_URL` to the current production URL. This will change to `https://dayspark.yuvoice.com` in Step 13.

### Test

- Run locally → app says "Dayspark" everywhere
- All visible app text says Dayspark, not OST
- PWA installs as "Dayspark"
- Existing magic-link sign-in keeps working (Supabase URL Configuration unchanged)

## Step 2 — Migration: simplify sharing model

Single migration file: `supabase/migrations/0020_simplify_sharing.sql`

```sql
-- Add the new columns
alter table posts add column is_public boolean not null default false;
alter table profiles add column show_name_on_shared boolean not null default false;

-- Note: existing posts intentionally stay private (is_public = false).
-- We do NOT migrate the old share_anonymous values across, because those were set under
-- a different sharing model that didn't ask the right question.

-- Drop the old columns (this also drops anything depending on them — update views first)
drop view if exists featurable_posts;

alter table posts drop column share_anonymous;
alter table posts drop column share_with_name;

-- Recreate the featurable_posts view with the new model
create view featurable_posts as
select p.*
from posts p
where p.moderation_status = 'approved'
  and p.is_public = true;

-- Update the feature_post RPC to use the new column
create or replace function feature_post(post_id uuid, display_mode_arg text)
returns featured_posts
language plpgsql security definer as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_admin boolean;
  v_post posts;
  v_featured featured_posts;
begin
  select is_admin into v_is_admin from profiles where id = v_actor_id;
  if not v_is_admin then raise exception 'not authorized'; end if;

  if display_mode_arg not in ('anonymous', 'with_name') then
    raise exception 'display_mode must be anonymous or with_name';
  end if;

  select * into v_post from posts where id = post_id;
  if not found then raise exception 'post not found'; end if;

  if v_post.moderation_status != 'approved' then
    raise exception 'post is not approved for featuring (status: %)', v_post.moderation_status;
  end if;

  if not v_post.is_public then
    raise exception 'user has not made this post public';
  end if;

  -- with_name display additionally requires the user's identity preference
  if display_mode_arg = 'with_name' then
    declare v_show_name boolean;
    begin
      select show_name_on_shared into v_show_name from profiles where id = v_post.user_id;
      if not v_show_name then
        raise exception 'user has not enabled show-name-on-shared';
      end if;
    end;
  end if;

  insert into featured_posts (post_id, display_mode, featured_by)
    values (post_id, display_mode_arg, v_actor_id)
    returning * into v_featured;

  insert into admin_audit (target_post, action, actor)
    values (post_id, 'post_featured', v_actor_id);
  return v_featured;
end $$;
```

The user runs this migration via the SQL Editor. **Verify**: query `select count(*) from posts where is_public = true` after migration — should be 0. All existing posts are private.

Update SCHEMA.md to reflect this. The `posts` table definition changes, the view changes, the RPC changes.

## Step 3 — Feed backend

### 3a — Reactions table

```sql
create table post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id) -- one reaction per user per post
);

create index on post_reactions(post_id);
create index on post_reactions(user_id);
```

A user can react to a post at most once. Tapping again removes the reaction (toggle behavior).

### 3b — RLS for reactions

```sql
alter table post_reactions enable row level security;

-- Anyone authenticated can see reactions on public posts
create policy "anyone reads reactions on public posts" on post_reactions
  for select using (
    exists (
      select 1 from posts
      where id = post_reactions.post_id
        and is_public = true
        and moderation_status = 'approved'
    )
  );

-- Users can react to public posts
create policy "users react to public posts" on post_reactions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from posts
      where id = post_reactions.post_id
        and is_public = true
        and moderation_status = 'approved'
    )
  );

-- Users can delete their own reactions
create policy "users remove own reactions" on post_reactions
  for delete using (auth.uid() = user_id);
```

### 3c — Feed query RPC

The Feed needs a paginated query that returns posts with reaction counts, the current user's reaction state, and the author's display name (conditionally on `show_name_on_shared`).

```sql
create or replace function get_feed(
  cursor_created_at timestamptz default null,
  page_size int default 20
)
returns table (
  post_id uuid,
  user_id uuid,
  post_text text,
  photo_url text,
  prompt_text text,
  post_date date,
  created_at timestamptz,
  display_name text,  -- null if author's show_name_on_shared = false
  reaction_count int,
  user_reacted boolean
)
language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
begin
  return query
  select
    p.id,
    p.user_id,
    p.text,
    p.photo_url,
    pr.text,
    p.date,
    p.created_at,
    case when prof.show_name_on_shared then prof.display_name else null end,
    coalesce((select count(*)::int from post_reactions where post_id = p.id), 0),
    exists (select 1 from post_reactions where post_id = p.id and user_id = v_user_id)
  from posts p
  join prompts pr on p.prompt_id = pr.id
  join profiles prof on p.user_id = prof.id
  where p.is_public = true
    and p.moderation_status = 'approved'
    and (cursor_created_at is null or p.created_at < cursor_created_at)
  order by p.created_at desc
  limit page_size;
end $$;

grant execute on function get_feed(timestamptz, int) to authenticated;
```

Cursor-based pagination (using `created_at`) is better than offset for infinite scroll — no shifting if posts are added during scrolling.

### 3d — Toggle reaction RPC

```sql
create or replace function toggle_reaction(target_post_id uuid)
returns boolean -- returns the new state (true = reacted, false = removed)
language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_existing post_reactions;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;

  -- Verify the post is publicly visible
  if not exists (
    select 1 from posts
    where id = target_post_id
      and is_public = true
      and moderation_status = 'approved'
  ) then
    raise exception 'post is not available for reactions';
  end if;

  -- Toggle
  select * into v_existing from post_reactions
    where post_id = target_post_id and user_id = v_user_id;

  if found then
    delete from post_reactions where id = v_existing.id;
    return false;
  else
    insert into post_reactions (post_id, user_id) values (target_post_id, v_user_id);
    return true;
  end if;
end $$;

grant execute on function toggle_reaction(uuid) to authenticated;
```

Test:
- Sign in as user A, make a post with `is_public = true`
- Sign in as user B, see post A on the Feed
- B taps reaction → DB shows row in `post_reactions`, count = 1
- A sees their post has 1 reaction
- B taps again → row removed, count = 0
- B can't see A's private posts on the Feed (set one with `is_public = false`, confirm absence)

## Step 4 — Feed UI

### 4a — Add fourth nav tab

In the bottom nav (`src/components/BottomNav.tsx`):
- Add a "Feed" tab between History and You (or wherever fits — the order Today / History / Feed / You feels right; consume your existing nav order)
- Icon: a stylized small stack of cards, or use `ti-news` from Tabler if matching the rest
- Same active/inactive treatment as other tabs

### 4b — Feed screen layout

`src/screens/Feed.tsx`:
- Neutral background (`#F1EFE8` per DESIGN.md — same as History) — **not** day-color rotation. The Feed shows posts from many different days; a single day-color would be misleading, and showing each in its own color would feel chaotic. Neutral surface lets the posts speak.
- Top: just the word "Feed" (24px, weight 500), no subtitle, no stats. The Feed is a destination, not a dashboard.
- Below: scrolling list of post cards

### 4c — Post card component

`src/components/FeedPostCard.tsx`. Each card:
- White background, rounded 18px, 16px padding, 12px gap between cards
- Prompt text at top (small, 12px, day-color accent of the post's actual day-of-week — this is the *one* place day-color appears subtly, as a small visual signature)
- Post text (15px, weight 400, line-height 1.5)
- Photo if present (max 320px height, rounded 12px, aspect preserved)
- Footer row: date + reaction button + reaction count
- If `display_name` is null (author opted not to share their name): footer shows just "the date" and "Posted [N] days ago"
- If `display_name` is set: footer shows "— Maya · [N] days ago"

### 4d — Reaction button

A small button: `✨ 12` showing the sparkle icon and current count.
- User hasn't reacted: outline button (transparent bg, day-accent text)
- User has reacted: filled button (day-accent bg, light text)
- Tap = toggle, updates locally optimistically, calls `toggle_reaction(post_id)`
- If the call fails, revert and show a small toast: "Couldn't save your reaction"

### 4e — Infinite scroll

- Initial load: `get_feed(null, 20)` → first 20 posts
- IntersectionObserver on the last card → when it enters view, fetch next 20 with `get_feed(last_post.created_at, 20)`
- Loading state: a small skeleton card at the bottom while fetching
- Empty state: if `get_feed` returns 0 posts (very early days), show a centered message: "The Feed is just getting started. Be the first to share a post." with a small link to Today.

### 4f — Pull-to-refresh

Standard pull-to-refresh on mobile, refresh button on desktop. Resets the cursor and reloads from the top.

Test:
- Open Feed → see public posts
- Scroll → load more
- React to a post → count updates immediately
- Refresh → see anything new

## Step 5 — Composer: single share toggle

In `src/components/PostComposer.tsx`:
- Remove the old two-toggle "Sharing" section entirely
- Add a single inline toggle directly below the input card, above the submit button:
  - Label: "Share publicly"
  - Subtitle: "Show on the Feed and let admins feature it"
  - Default OFF
  - When ON, the post will be `is_public = true` on submit
- Visual: a single switch toggle, same component used elsewhere, with the day-accent color when on
- A small tooltip / info icon next to the label shows a one-liner: "Public posts appear on the Feed for all users." Tap to see a longer explanation including "Your name only appears if you've enabled that in Settings."

On submit, persist `is_public` from the toggle state. If the toggle is on AND the user has `show_name_on_shared = false`, the post will appear publicly with no author name. This is correct behavior; no special UI needed at submit time.

In the **history view** (`src/screens/History.tsx`), each past post gets:
- A small "Share publicly" toggle, same as composer
- Tapping the toggle updates `posts.is_public` for that post
- A confirmation moment when toggling ON: a brief inline confirmation "This post is now on the Feed." or similar

Test:
- New post with toggle OFF → submitted, `is_public = false`, doesn't appear on Feed
- New post with toggle ON → submitted, `is_public = true`, appears on Feed within a moment
- Old post: flip its toggle in history → updates, appears on Feed
- Old post: flip its toggle OFF → disappears from Feed

## Step 6 — Settings: show-name-on-shared toggle

In `src/screens/Profile.tsx` (or the Settings section, depending on how M2 structured this):

- Add a new section "Identity":
  - Label: "Show my name on shared posts"
  - Subtitle: "When you share a post publicly, your name will appear next to it. Off means your shared posts have no byline."
  - Toggle, default OFF
  - Writes to `profiles.show_name_on_shared`

Critically: changing this setting affects *all* of the user's already-shared posts immediately. The Feed query reads the current value at query time, so the display updates the next time anyone loads the Feed. The user sees their own shared posts updated immediately.

Test:
- User toggles ON → Feed shows their name on their shared posts
- User toggles OFF → Feed shows their shared posts with no byline
- Other users' posts unaffected

## Step 7 — Polish the `/p/{id}` page

Existing public page from M3. M5 makes it good.

### Layout

- Full-bleed background using the post's day-of-week color (the palette from `dayPalette(post.date)`)
- Decorative shapes scaled and positioned for a wider canvas
- Center the content vertically and horizontally, max-width ~640px on desktop
- Wordmark in the top-left: "DAYSPARK" (small, letter-spaced, links to homepage)
- Prompt as a small label above the post (smaller, letter-spaced, feels like a category tag)
- Post text large and centered (28px desktop, 22px mobile, weight 500)
- If photo: below the text, max-width 480px, rounded corners
- Author attribution at the bottom:
  - If the post's author has `show_name_on_shared = true` AND the feature uses `display_mode = 'with_name'`: "— {display_name}"
  - Otherwise: omit entirely (no "— anonymous" — let the post speak)
- Footer: "Featured on Dayspark · Read more →" linking to the homepage

### When the post is no longer public

If the post has been unfeatured, the author revoked `is_public`, or `moderation_status` is anything other than `approved`:
- Return HTTP 410 Gone
- Render polite page: "This post is no longer public. It may have been taken down by its author or by a moderator." with a link to the homepage

### Authenticated visitors

If a signed-in user visits `/p/{id}`, the page renders the same way, plus a small floating "Open in app →" CTA in the bottom-right linking to `/today`.

Test:
- Visit a featured post → renders beautifully
- Admin unfeatures → 410
- Author revokes `is_public` → 410
- Photo present → photo renders below text
- Author show_name_on_shared = true → name shown
- Author show_name_on_shared = false → no name

## Step 8 — og:image generation

Server-side via `@vercel/og`. Create a Vercel Edge function at `api/og/[postId].png`:
- Takes a post ID
- Calls `get_featured_post(postId)` via Supabase
- If post is not currently featured: return a generic "Dayspark" branded card with today's color
- If post is featured: generate a 1200×630 card with:
  - Day-of-week color background
  - Scaled decorative shapes
  - Prompt as small label at top
  - Post text large and centered (truncate at ~180 chars with ellipsis if longer)
  - Author attribution at bottom (only if show_name_on_shared AND with_name)
  - "DAYSPARK · {derive bare host from VITE_PUBLIC_BASE_URL}" wordmark in the corner
- Cache: `Cache-Control: public, max-age=86400, s-maxage=86400`

og:tags in the `/p/{id}` page HTML head:

```html
<meta property="og:title" content="Dayspark — {first 50 chars of post}…" />
<meta property="og:description" content="{prompt text}" />
<meta property="og:image" content="{VITE_PUBLIC_BASE_URL}/api/og/{postId}.png" />
<meta property="og:url" content="{VITE_PUBLIC_BASE_URL}/p/{postId}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Dayspark" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="{VITE_PUBLIC_BASE_URL}/api/og/{postId}.png" />
```

These need SSR for the og:image preview to work — meta tags must be in the initial HTML response, not added by JavaScript after hydration. Either move just the `/p/{id}` route to a Vercel Serverless Function that renders HTML server-side, or use `react-helmet-async` with server-rendered HTML.

For posts with photos: **render the og:image as text-only with the day-color background.** Don't try to composite the photo into the preview card. Reasons: text-on-color reproduces cleanly at iMessage thumbnail sizes; photos overlaid with text are hard to make readable; if the photo fails to load there's a clean fallback for free.

Test on real platforms before considering this step done:
- Twitter Card Validator (cards-dev.twitter.com/validator)
- Facebook Sharing Debugger (developers.facebook.com/tools/debug)
- LinkedIn Post Inspector (linkedin.com/post-inspector)
- Real iMessage paste

## Step 9 — Homepage

Currently the root `/` shows the sign-in screen for unauthenticated visitors. M5 changes this.

### Routing

- Unauthenticated visitor to `/` → homepage
- Authenticated visitor to `/` → redirect to `/today`
- Anyone visiting `/sign-in` → sign-in screen (unchanged)

The homepage gets a "Sign in" link in the top right that goes to the existing sign-in flow.

### Sections

**Hero**:
- Full-bleed background using *today's* color (homepage color shifts daily, matches the app)
- Wordmark "DAYSPARK" at the top
- Headline: "One prompt a day. Something quiet, just for you."
- Subhead: one sentence explaining the loop
- CTA: "Start" button → sign-in flow
- Decorative shapes from the day's palette, scaled up

**Recently featured posts**:
- Fetched from `featured_posts` joined to `posts`, ordered by `featured_at desc`, limit 3
- Each as a smaller card in the post's day color, linking to `/p/{id}`
- Section title: "What people are writing"
- If fewer than 3 featured posts exist, hide the section entirely

**How it works**:
- Three numbered bullets, conversational tone:
  1. "One prompt every day. Different for everyone."
  2. "Answer in 280 characters or a photo."
  3. "Build a streak. Miss a day? Use a grace day."
- Same icons/treatment as M1 onboarding screen 2

**Footer**:
- Subtle "DAYSPARK BY YUVOICE" wordmark
- Privacy, Terms, Contact links
- "© 2026 Yuvoice" copyright

### Performance

- Static parts cached/pre-rendered
- "Recently featured posts" cached at edge for 5 minutes
- Homepage og:image: a static card with the Dayspark wordmark on today's color

Test:
- Visit `/` while signed out → homepage
- Visit `/` while signed in → redirect to `/today`
- Featured posts section shows real featured posts
- Day color rotates with today's date

## Step 10 — SEO + cache invalidation

### robots.txt

```
User-agent: *
Allow: /
Allow: /p/

Disallow: /admin/
Disallow: /today
Disallow: /history
Disallow: /feed
Disallow: /profile
Disallow: /settings

Sitemap: {VITE_PUBLIC_BASE_URL}/sitemap.xml
```

Note: `/feed` is *not* indexable because it requires auth and shows user content that's only meant to be visible to signed-in users.

### sitemap.xml

Dynamic at `/sitemap.xml`:
- Homepage at priority 1.0
- Each currently-featured `/p/{id}` at priority 0.6

### Indexability metadata

- Homepage: `<meta name="robots" content="index,follow" />`
- `/p/{id}` for featured posts: `index,follow`
- `/p/{id}` after unfeatured (the 410 page): `noindex`

### Cache invalidation

When a post is unfeatured (admin or auto-trigger), invalidate:
- `/p/{id}` page HTML
- og:image for that post
- sitemap.xml

Implementation: the admin "Unfeature" UI action calls `/api/revalidate/featured-post?id={postId}` which:
- Calls `revalidatePath('/p/{postId}')`
- Calls `revalidatePath('/sitemap.xml')`
- Purges the og:image URL

For auto-unfeatures (the DB trigger), write to an `invalidation_queue` table that a cron polls every 5 minutes.

### Feed posts vs featured posts

Posts on the Feed are NOT indexed or in the sitemap. They're behind auth. Only the admin-curated `featured_posts` rows get public URLs.

## Step 11 — Privacy, terms, contact

- `/privacy` — privacy policy: what data Dayspark collects (email, posts, photos, reactions), how long, who it's shared with (Yuvoice operates it, no third parties beyond infrastructure providers), how users can request deletion
- `/terms` — basic terms: acceptable use, admin's right to remove content, users grant permission to feature posts they mark public, no warranty
- `/contact` — simple page with the email address `makehistory@yuvoice.com` (this is a live, working address — verified accepting mail). The address is on `.com` for branding consistency even though Yuvoice's other email infrastructure is currently on `.org`.

These must exist before public launch. Use a generator if you don't want to write them by hand; just make sure they're accurate about what the app actually does. Both pages link from the homepage footer and from Settings.

## Step 12 — Pre-launch checklist (on the Vercel-default URL)

Before doing the domain switchover, walk through everything on the current Vercel URL. The point is to catch issues while the production URL hasn't been promised to anyone yet.

- [ ] Magic-link emails branded "Dayspark"
- [ ] PWA installs as "Dayspark"
- [ ] Migration 0020 run; verify `is_public = false` for all existing posts (`select count(*) from posts where is_public = true` returns 0)
- [ ] Feed shows public posts; private posts hidden
- [ ] Reactions work (toggle on, count updates, toggle off, count decrements)
- [ ] Composer's single share toggle works; defaults OFF
- [ ] Settings show-name-on-shared toggle works; affects display
- [ ] `/p/{id}` renders beautifully for featured posts; 410s gracefully when unfeatured
- [ ] og:image works in real share previews (Twitter Card Validator, Facebook Sharing Debugger — using the current Vercel URL with `VITE_PUBLIC_BASE_URL` set to it)
- [ ] Homepage at `/` works for unauthenticated visitors
- [ ] robots.txt blocks authenticated routes
- [ ] sitemap.xml lists homepage + featured posts
- [ ] Manual unfeature invalidates caches quickly
- [ ] Auto-unfeature invalidates caches within 5 minutes
- [ ] Privacy / Terms / Contact pages exist
- [ ] Tested on a real phone, real browser, real social platforms

If everything passes on the Vercel-default URL, proceed to Step 13.

## Step 13 — Production domain switchover

The flip-to-production ceremony. All the Vercel, DNS, and Supabase URL work happens here, in one focused session. Do all of these in sequence; expect 30-45 minutes total including DNS propagation.

### 13a — Vercel: rename project and add custom domain

In the Vercel dashboard:

1. Project Settings → General → Project Name → rename to `dayspark` (or `dayspark-yuvoice` if `dayspark` is taken on Vercel's namespace). Save. Vercel URL becomes `dayspark.vercel.app`.
2. Project Settings → Domains → Add Domain → enter `dayspark.yuvoice.com`. Vercel will display a CNAME target (typically `cname.vercel-dns.com`) and instructions. Keep this page open — you'll need the value in 13b.

### 13b — NetNation: add the CNAME record

**Take a screenshot of NetNation's current DNS records page before making any changes.** Five seconds of insurance.

1. Log into NetNation, navigate to the DNS management for `yuvoice.com`
2. Add a new record:
   - Type: CNAME
   - Host/name: `dayspark`
   - Value/points to: the value Vercel gave you in 13a (typically `cname.vercel-dns.com`)
   - TTL: whatever NetNation defaults to (usually 3600 / 1 hour is fine)
3. Save
4. **Verify the apex `yuvoice.com` records are untouched** — the existing A record for the WordPress site should be unchanged. You're *adding* a new record, not modifying any existing one.

### 13c — Wait for DNS propagation

Usually 5-15 minutes. Some networks cache longer. To check status:

- In the Vercel Domains page, look for "Valid Configuration" next to `dayspark.yuvoice.com`
- Or from a terminal: `dig dayspark.yuvoice.com` — should return Vercel's IP
- Or use `dnschecker.org` to see global propagation status

While waiting, proceed to 13d.

### 13d — Make `dayspark.yuvoice.com` the production domain in Vercel

Once the CNAME is valid:

1. Vercel Domains page → next to `dayspark.yuvoice.com`, click "Set as production domain" (or similar wording)
2. This makes Vercel issue redirects from the default `*.vercel.app` URL to `dayspark.yuvoice.com`, and use the custom domain as canonical for og:tags, etc.

### 13e — Supabase: update Auth URL Configuration

1. Supabase Dashboard → Authentication → URL Configuration:
   - Set **Site URL** to `https://dayspark.yuvoice.com`
   - In **Additional Redirect URLs**, add `https://dayspark.yuvoice.com/**`
   - Keep `http://localhost:5173/**` for development
   - Save
2. **This is critical**: without this, magic-link emails will continue sending users to the old Vercel default URL. Sign-ins from production would still technically work via the redirect set up in 13d, but new magic-link clicks would land on the wrong domain.

### 13f — Supabase: update email templates

1. Authentication → Email Templates → Magic Link
2. Subject and body: ensure the app name is "Dayspark" (should already be from Step 1 of M5, but worth a final check)
3. The link itself uses `{{ .SiteURL }}` which now resolves to `dayspark.yuvoice.com`. Save.

### 13g — Update the Vercel env var

1. Vercel → Project Settings → Environment Variables
2. Change `VITE_PUBLIC_BASE_URL` from the old Vercel default URL to `https://dayspark.yuvoice.com`
3. Redeploy (Vercel asks you to; one click). After redeploy, og:images, sitemap, and any other absolute URLs now reference the custom domain.

### 13h — GitHub repo (optional)

If you want to rename the GitHub repo to match: Settings → repository name → save. Update your local clone's remote URL: `git remote set-url origin <new-url>`. Doesn't affect anything functional.

### 13i — Final verification

- Visit `https://dayspark.yuvoice.com` — app loads
- Sign out, sign in via magic link — the link in the email points to `dayspark.yuvoice.com` (not the old URL)
- Visit a featured post via `https://dayspark.yuvoice.com/p/{id}` — renders, og:image works
- Share a `/p/{id}` link in iMessage or Slack — preview shows the og:image at the new domain
- Confirm `yuvoice.com` (the WordPress site) is still working at the apex
- Confirm the old Vercel-default URL either redirects to `dayspark.yuvoice.com` or also serves the app (Vercel handles both gracefully)

### If something breaks

- **CNAME not validating after an hour**: check that the host is just `dayspark`, not `dayspark.yuvoice.com`, in NetNation's interface. Some interfaces want the bare subdomain, others want the full host. Also check there's no pre-existing A record for `dayspark` that's conflicting.
- **Magic-link emails still go to old URL**: Supabase Site URL not updated. Recheck 13e.
- **og:images broken**: VITE_PUBLIC_BASE_URL env var not updated, or you haven't redeployed since changing it.
- **WordPress site broken**: this should be impossible from this sequence, but if it is — restore from the screenshot you took in 13b. The most likely culprit would be accidentally editing an apex record instead of adding the new subdomain.

## Acceptance criteria for M5 done

Same as the deploy checklist above. All boxes ticked, deployed to production.

## Out of scope for M5 (defer)

- Comments or threaded replies on Feed posts — explicitly out, the calm tone depends on this
- Multiple reaction types — single ✨ only
- Following / followers / friends system — no
- Direct messaging between users — no
- "Who reacted" view (showing which users reacted to a post) — privacy, defer
- Feed filters ("today only", "this week") — chronological all-time is fine for now
- User profile pages (`/u/{username}` showing all a user's public posts) — privacy implications, defer
- A blog or content marketing site
- Newsletter signup
- Subscribe to RSS of featured posts
- Multi-language support
- Search interface for Feed posts — defer until volume warrants it

## Notes for Claude Code

- M5 is the largest milestone in scope since M1. Don't try to ship it in one go; the build order is designed so each step is independently shippable.
- The rename (Step 1) is the most visible change — do it first, ship it, breathe.
- The migration in Step 2 is the highest-stakes single piece. Verify counts before and after.
- **Do NOT touch Vercel domain settings, Supabase URL Configuration, or DNS during Steps 1-12.** All that work is consolidated in Step 13. The user explicitly asked to defer the domain switchover to last.
- Steps 1-12 work on the existing Vercel-default URL. Use the `VITE_PUBLIC_BASE_URL` env var (set in Step 1) wherever absolute URLs are emitted. Don't hardcode `dayspark.yuvoice.com` anywhere — that's a Step 13 concern.
- Don't try to compose photos into og:images. Text-only previews on day-color backgrounds.
- The Feed and the `/p/{id}` page have completely separate moderation surfaces. Feed posts are protected by auth + RLS. `/p/{id}` is public via the admin curation gate. Keep them mentally distinct.
- Don't add Next.js for SSR. Just carve out the `/p/{id}` route as a Vercel Serverless Function.
- After Step 5 (composer) ships, an admin should manually share-toggle a few of their own existing posts to seed the Feed so it's not empty when other users see it.
- Reactions are a single ✨ icon. No emoji picker, no multiple reaction types. This is deliberate.
- Step 13 is mostly user-driven (Vercel and NetNation dashboards). Claude Code's job there is to verify the `VITE_PUBLIC_BASE_URL` env var gets bumped and to test the post-switchover flow.
