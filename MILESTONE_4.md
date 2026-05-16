# Milestone 4 — Moderation

Goal: every post is automatically screened for harmful content (text + images), high-risk content is flagged for admin review and held back from being shared externally, and users can opt their posts into being featured (anonymously or with their name).

This is the **launch gate**. After M4 ships, the app is safe to open to a wider audience beyond your friend group. Before M4 ships, don't.

Prerequisite: M1, M2, M2.1 complete. M3 complete and locked (no further changes to M3 — M4 fits around what M3 already shipped).

## Important: M3 already shipped without M4 in mind

M3 shipped the admin "Feature on website" flow with a UI that doesn't know about moderation status. That's fine. M4 fits around it:

- **M4 updates the `feature_post()` RPC** to also require `moderation_status = 'approved'`. The function is replaced via `CREATE OR REPLACE`. M3's deployed UI keeps calling it; calls just start failing with a clearer error message for held/pending posts. This is acceptable interim behavior — only admins see the failure, and admins are you and your teammate.
- **Step 5.5 (added below)** does the small admin-UI polish to disable the "Feature" button for non-eligible posts with a tooltip explanation. This is technically a touch-up to an M3 screen, but it's an M4-driven enhancement, not a "fixing M3" change.
- **The composer share toggles** are entirely new (M4 Step 1) — M3 never touched the composer. No conflict there.

## Build philosophy for M4

- **Gentle by default**: a flagged post is still visible to its author. They never see "your post was flagged." Friction here would create paranoia in a journaling app where many people write things they'd never want a robot to judge.
- **Defense in depth**: automated screening + manual review queue + share permission opt-in. No single layer is the only thing standing between bad content and a public surface.
- **Cost-aware**: every external API call costs money or has a quota. Build in rate limits and circuit breakers so a bug can't cost $500.
- **Failure-tolerant**: if the moderation APIs go down, posts still go through (just not eligible for featuring until manually reviewed). Never block the user's primary action because a third party is having a bad day.
- **No mind-reading**: only flag based on explicit categories (hate, sexual, violence, etc.). Don't try to detect "low quality" or "spam" with content classifiers — those are subjective and break trust.

## What gets built

1. **Share permission toggles** in the post composer (the UI for the two flags already in the DB)
2. **Automated text moderation** via OpenAI Moderation endpoint
3. **Automated image moderation** via Google Cloud Vision SafeSearch
4. **Admin review queue** UI
5. **Eligibility logic** — only "approved" posts are featurable
6. **Rate limits and cost guards**

---

## Step 1 — Share permission toggles in composer

These already exist in the DB (`posts.share_anonymous` and `posts.share_with_name`, default `false`) and in the mock designs. Now wire them up in the UI.

- In `src/components/PostComposer.tsx`, below the input card and above the submit button, add a "Sharing" section per the design mock:
  - Soft secondary surface (uses `--day-surface` with reduced opacity)
  - Small label "SHARING" in the day's deep accent color
  - Two toggle rows:
    - **Allow anonymous use** — subtitle: "May be featured without your name"
    - **Allow with my name** — subtitle: "May be featured as '— {display_name}'"
  - Both default OFF
- The toggles can be flipped independently. Both off = fully private. Both on = admin chooses at feature time. Either alone = constrained.
- **Persisted to the post on submit**: the values write to `posts.share_anonymous` and `posts.share_with_name` columns
- **Editable retroactively**: in the history view (`src/screens/History.tsx`), each past post gets a small "Sharing" affordance to flip toggles. Changing them updates the DB and triggers re-evaluation of any `featured_posts` row (an admin alerted if a featured post becomes ineligible — see Step 5)
- Show toggles only when the post is text-only or text+photo. If photo-only, still show but disabled with a note: "Photo-only posts can be featured if you opt in here."
- **Copy that matters**: the language must be unambiguous about what users are opting into. "May be featured" is correct — not "will be featured." Users grant *permission*, not certainty.

Migration: none — DB columns exist. Just UI work.

Test:
- New post: both toggles off → post submits with both columns false
- Flip "allow anonymous" → submit → DB shows `share_anonymous = true`, `share_with_name = false`
- Go to history, find the post, flip "allow with my name" → DB updates
- Photo-only post: toggles are present and functional

## Step 2 — Automated text moderation

Wire up OpenAI's Moderation endpoint. It's free and stays free.

### 2a — Setup

- Add `OPENAI_API_KEY` to Supabase Edge Function secrets (via dashboard)
- Get the key from platform.openai.com (free, doesn't require billing card for the moderation endpoint specifically — verify this current at the time of build, may have changed)
- The moderation endpoint URL: `https://api.openai.com/v1/moderations` with the `omni-moderation-latest` model

### 2b — Edge Function

Create `supabase/functions/moderate-text/index.ts`:
- Accepts: `{ post_id: uuid, text: string }`
- Calls OpenAI Moderation, parses the response
- Categories that matter for this app:
  - `hate`, `harassment` → flag at confidence > 0.5
  - `sexual`, `sexual/minors` → flag at confidence > 0.3 (lower threshold; this is a journaling app, sexual content is out of scope for featuring)
  - `self-harm/intent`, `self-harm/instructions` → special handling: these are NOT flagged for moderation purposes (we're not policing personal expression). But if detected, do NOT auto-feature the post and quietly add to a separate "user wellbeing aware" admin view. The point is to give admin awareness, not to censor.
  - `violence/graphic` → flag at confidence > 0.6
- If flagged: insert a row into `moderation_queue` with `reason = 'auto_text'`, scores as JSONB, and update the post's `moderation_status` to `'held'`
- If clean: update the post's `moderation_status` to `'approved'`. No queue row.
- Update the post's `share_eligibility` (see Step 5)
- Return: `{ status: 'approved' | 'held', categories?: string[] }`. The client doesn't display this to the user — it's logged for the client to optionally update local state.

### 2c — Trigger

- After `submit_post()` RPC succeeds (or inside it, depending on transaction boundaries), invoke the `moderate-text` Edge Function asynchronously
- Don't block the user's submit on moderation — the post lands in `moderation_status = 'pending'`, then the function flips it to `approved` or `held` within seconds
- User sees no moderation UI — their post appears in the completed state immediately

### 2d — Failure handling

- If the OpenAI API call fails (timeout, 5xx, etc.): leave the post in `moderation_status = 'pending'`. Log to `moderation_errors` table for admin awareness.
- Pending posts are NOT featurable until either moderation succeeds or an admin manually approves
- Retry logic: a separate cron job runs every hour and retries any post stuck in `pending` for more than 10 minutes. Max 3 retries; after that the post stays pending and surfaces in an admin "needs attention" list.

Migration: `supabase/migrations/0007_moderation_text.sql` — extends `moderation_status` enum if needed (already includes `pending`/`approved`/`held`/`hidden`), creates `moderation_errors` table.

Test:
- Post normal text → status moves from `pending` to `approved` within ~3 seconds; no queue row
- Post text with explicit hate speech → status moves to `held`; row in `moderation_queue`
- Disable the OpenAI key temporarily, post → status stays `pending`; error logged

## Step 3 — Automated image moderation

Same pattern as text, with Google Cloud Vision SafeSearch.

### 3a — Setup

- Create a Google Cloud project (free, requires Google account)
- Enable the Cloud Vision API
- Create an API key (Console → APIs & Services → Credentials)
- Set up budget alerts in Google Cloud at $5 and $10 thresholds — Vision is normally cheap but a bug could cause runaway calls
- Add `GOOGLE_VISION_API_KEY` to Supabase Edge Function secrets

### 3b — Edge Function

Create `supabase/functions/moderate-image/index.ts`:
- Accepts: `{ post_id: uuid, photo_url: string }`
- Fetches the photo via the URL (signed URL from Supabase Storage), sends to Vision API with `SAFE_SEARCH_DETECTION`
- Vision returns scores for: `adult`, `spoof`, `medical`, `violence`, `racy` — each as `VERY_UNLIKELY` through `VERY_LIKELY`
- Flag if any of these hit `LIKELY` or `VERY_LIKELY`:
  - `adult` (any LIKELY+ → flag)
  - `racy` (LIKELY+ → flag, VERY_LIKELY → high-confidence flag)
  - `violence` (LIKELY+ → flag)
- `medical` and `spoof` are not flagged — they're not in scope for this app
- Insert into `moderation_queue` with `reason = 'auto_image'`, scores as JSONB
- Same status flow as text

### 3c — Trigger

- After post submit, if `photo_url` is set, fire the `moderate-image` Edge Function
- Both text and image moderation can run in parallel for posts with both
- A post is `approved` only if all applicable moderations clear. If text passes but image fails, status = `held`.

### 3d — Cost guard

- Add a daily counter (in `config` table or a dedicated `api_usage` table): tracks total Vision calls today
- If counter > 500 calls in 24 hours → circuit breaker: skip Vision, mark image moderation as `pending`, alert admin via the moderation dashboard
- Reset counter daily via cron
- This prevents a bug from accidentally hitting the free tier limit and blowing past into paid calls. 500/day is well under the 1,000/month free tier even on a busy day.

Migration: `supabase/migrations/0008_moderation_image.sql` — `api_usage` table, scheduled reset.

Test:
- Post a normal photo → status approved within a few seconds
- Post a photo that's clearly racy → status held, queue row appears
- Manually set api_usage counter to 501 in DB, post a photo → moderation stays pending, admin alert shows

## Step 4 — Admin moderation queue UI

The `moderation_queue` table already exists from M1 schema. Now build the admin UI.

- Add a new admin route: `/admin/moderation`
- The screen shows: queue of held/pending posts, count badge in admin nav if non-empty
- Per row: post excerpt, photo thumbnail (if any), flagged categories, scores, when, action buttons
- Actions:
  - **Approve** — sets post status to `approved`, removes queue row, the post becomes featurable
  - **Hide** — sets post status to `hidden` (existing M3 hide flow), removes queue row, post disappears from author's view too
  - **Ignore (false positive)** — sets post status to `approved`, marks queue row as reviewed with `decision = 'ignore'`, post becomes featurable. Keep the row in `moderation_queue` for analytics — we want to know our false positive rate.
- All actions logged to `admin_audit`
- Filter tabs: **Needs review** (default — held + pending), **Errored** (moderation failed), **Wellbeing aware** (self-harm signals), **All history**
- The wellbeing tab is special: no action buttons. Read-only awareness for admins to optionally reach out via out-of-band channels. Posts here are not featurable but are not held — author sees them normally.

Build `src/screens/Admin/Moderation.tsx`.

Test:
- Post bad content → it shows up in the queue
- Click Approve → post becomes featurable from the regular posts dashboard
- Click Hide → post is gone from author's view too
- Click Ignore → post becomes featurable; analytics tag preserved

## Step 5 — Eligibility logic

The single rule: **a post is featurable if and only if** all of:
- `moderation_status = 'approved'`
- At least one of `share_anonymous = true` or `share_with_name = true`
- The user's account is not suspended (not a concept yet; placeholder for future)

This rule is computed everywhere it matters, but the source of truth is a generated column or a `share_eligibility` view:

```sql
create view featurable_posts as
select * from posts
where moderation_status = 'approved'
  and (share_anonymous = true or share_with_name = true);
```

M3's admin "feature on website" action sheet should:
- Disable the "Feature on website" button if the post is not in `featurable_posts`
- Show a tooltip explaining why: "User has not granted share permission" OR "Post is held for moderation review"

M3's existing `feature_post()` RPC already checks `share_anonymous` and `share_with_name`. Extend it to also check `moderation_status = 'approved'` and raise a clear error otherwise.

### Retroactive ineligibility

If a user toggles their share permissions OFF on a post that's currently featured (`featured_posts` has an active row), what happens?

- The featured row is automatically `unfeatured_at = now()` (via a trigger on `posts` updates)
- An audit entry is logged
- An admin notification is queued (a `notifications` table or just appears in a "recent changes" admin view)
- The `/p/{id}` page returns 404 once unfeatured

Migration: `supabase/migrations/0009_eligibility_trigger.sql`

Test:
- Approve a post, opt in to anonymous sharing, admin features it, visit `/p/{id}` → renders
- User toggles anonymous OFF → `/p/{id}` returns 404; admin sees the change in audit log
- Admin tries to feature a held post → error: "Post is held for moderation review"
- Admin tries to feature a post with no share permission → error: "User has not granted share permission"

## Step 5.5 — Admin UI polish for non-eligible posts

Small touch-up to M3's admin posts dashboard so the "Feature on website" action sheet plays nicely with M4's new eligibility check.

This is a small, surgical change to an existing M3 screen. Be careful not to refactor anything else while you're in there.

- In the per-post action sheet (built in M3), the "Feature on website" button:
  - Is **disabled** if the post is not in `featurable_posts` view (i.e. not approved OR no share permissions)
  - Shows a tooltip on hover/long-press explaining why:
    - If `moderation_status = 'held'` → "Post is held for moderation review"
    - If `moderation_status = 'pending'` → "Moderation check is still running"
    - If both share toggles are false → "User has not granted share permission"
    - If multiple reasons → list the most blocking one first (held > pending > no permission)
- A small badge on the post card in the dashboard list shows the eligibility status at a glance:
  - "Featurable" (green) for `featurable_posts`
  - "Held" (orange) for moderation_status = 'held'
  - "Pending review" (gray) for pending
  - "Private" (light gray) for approved-but-no-share-permission
- Filter the admin posts dashboard to add a "Featurable" filter pill that narrows the list to currently-eligible posts. This is the one you'll use most when curating posts to feature externally.

No new RPCs needed — the eligibility data comes from the `featurable_posts` view from Step 5 and the `moderation_status` column. Just UI work.

Test:
- Sign in as admin, view a post in `pending` → button disabled, tooltip says so
- View a post that's approved but with no share permissions → button disabled, "User has not granted share permission"
- View an approved + shareable post → button enabled, works as before
- Use the "Featurable" filter → only posts you can actually feature appear

## Step 6 — Rate limits and abuse prevention

Light touch since we're not facing a real attack surface yet, but worth having.

- **Per-user post rate**: a user can submit at most 1 post per day (already enforced by the unique constraint on `posts(user_id, date)`). The 5-minute edit window allows up to 10 updates to that post; after the 10th update in 5 minutes, lock further updates. Prevents accidental client-loop bug from spamming the DB.
- **Per-user moderation calls**: capped at the same rate — one moderation event per post per submission, plus N retries. No way to trigger arbitrary moderation calls.
- **Photo upload size limit**: enforced at 5MB in the storage policy (already in place from M1).
- **Photo upload rate**: max 3 photo uploads per user per day. If a user retries upload more than 3 times in a day, the storage RLS rejects further uploads. They can still post text-only.
- **Edge Function timeout**: set to 30 seconds. Moderation calls that hang past 30s fail loudly and the post stays in `pending`.

Migration: `supabase/migrations/0010_rate_limits.sql` — adds the 10-update-per-5-min check to posts, the 3-upload-per-day check via a function called from storage RLS.

## Step 7 — Wellbeing awareness (the self-harm category)

This is a delicate part. Build it carefully.

- Self-harm detection from OpenAI Moderation is treated separately from other flags
- Posts flagged for self-harm:
  - Are NOT held back from the author (no friction)
  - Are NOT featurable
  - Appear in the admin Moderation screen under a "Wellbeing aware" tab
  - The author is never told
- The admin view here is read-only by design. Admins might want to reach out via out-of-band channels (DM, email) but they should not take action *in the app* based on this.
- The admin Moderation screen shows a small static disclaimer at the top of this tab:
  > "These posts contain language that may indicate the author is going through something hard. Use your judgment. If you reach out, do so privately and with care. We're not licensed mental health professionals."
- This category gets no audit-log entries (privacy concern — we don't want a permanent record of which users wrote what kind of distressed content)

This isn't crisis intervention — it's awareness. We're not building a hotline. But ignoring the signal entirely would also be wrong for an app this personal.

## Step 8 — Deploy + validation period

- Deploy all Edge Functions via Supabase dashboard
- Add the new environment variables to Vercel and Supabase function secrets
- Run all migrations via SQL Editor (10 total since M1 if you've kept the numbering)
- Test each moderation path end-to-end with deliberately crafted content
- **Validation period**: run M4 in production with the existing friend-group users for at least 5–7 days before opening to a wider audience. Watch the moderation queue. Make sure:
  - False positive rate is low (less than ~5% of posts get held)
  - Admin queue doesn't get backed up
  - No posts are stuck in `pending` due to API failures
  - Vision API usage stays well under the daily 500-call cap

If anything looks broken during validation, fix and re-test before the public launch.

## Acceptance criteria for M4 done

- [ ] Share permission toggles appear in the composer and persist correctly
- [ ] Toggles editable on past posts from the history view
- [ ] Text moderation runs on every post and updates status within seconds
- [ ] Image moderation runs on every photo upload and updates status within seconds
- [ ] Both moderations run in parallel for posts with both
- [ ] Held posts appear in `/admin/moderation` with category info
- [ ] Admin can Approve / Hide / Ignore from the queue
- [ ] Approved posts become featurable; held posts cannot be featured
- [ ] Admin posts dashboard shows eligibility badge per post (Featurable / Held / Pending review / Private)
- [ ] "Feature on website" button is disabled with explanatory tooltip when post isn't eligible
- [ ] "Featurable" filter on admin dashboard works
- [ ] User toggles share OFF on a featured post → it's auto-unfeatured
- [ ] Failed moderation calls leave posts in `pending`; retry cron resolves them
- [ ] Vision API circuit breaker prevents runaway costs
- [ ] Rate limits prevent spam scenarios
- [ ] Self-harm signals appear in the wellbeing-aware tab, not the regular queue
- [ ] Validation period (5–7 days) shows acceptable false-positive rate
- [ ] Deployed and verified end-to-end

## Out of scope for M4 (defer)

- User-facing "report this post" button (no public posts means nothing to report yet — defer to whenever there's a public feed)
- Appeals process for hidden posts (manual via email contact for v1)
- Account suspension for repeat offenders (no signal yet that this matters)
- A "moderate by category" view with separate queues per category (one combined queue is fine)
- Real-time admin notifications when a post is held (admin sees it on next dashboard load — fine for current scale)
- ML model for "low quality" or "spam" detection — explicitly out of scope, not what this app needs
- Translating moderation results (English-only API responses are fine for English-only app v1)

## Costs to expect

- **OpenAI Moderation**: free, no quota. Stays free.
- **Google Cloud Vision SafeSearch**: 1,000 free per month, then ~$1.50/1,000 after. With ~10 active users posting 1 photo/day = ~300/month — comfortably free. The circuit breaker at 500/day means worst-case monthly cost capped at ~$22.
- **Edge Function invocations**: 500K free/month on Supabase. Even at 1,000 daily users we'd use less than 100K/month.

Total monthly cost at launch-scale: **$0**. At 1,000 users: still close to $0 unless the photo posting rate is unusually high.

## Notes for Claude Code

- Two new Edge Functions to deploy via dashboard: `moderate-text`, `moderate-image`. Don't combine them — they fail independently and that's by design.
- The `pending → approved/held` transition should always happen via Edge Function or admin action. Never let the client set `moderation_status` directly.
- The wellbeing-aware behavior in Step 7 is sensitive. Read it twice before implementing. The user-facing rule is: the author never knows their post was flagged for any category, ever.
- Don't add any "moderation in progress" UI for the user. The post just appears in their completed state immediately. The status transitions happen invisibly.
- If you're tempted to add a "report content" button anywhere in M4, stop. There's nothing public to report yet.
- Test with deliberately bad content before considering M4 done. The whole point is that this works for real adversarial input, not just clean test cases.
