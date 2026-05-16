# Milestone 3 — Admin

Goal: a working admin experience at `/admin/*` that lets you and your teammate manage prompts, monitor all posts, manually moderate, generate share cards for featured posts, and invite additional admins.

Prerequisite: M1 complete and ideally M2 complete (though M3 doesn't strictly depend on M2 — they can be developed in parallel since they touch different surfaces).

## Why M3 is ordered this way

Your priorities, in order:
1. Prompt management — you and your teammate need this to stop being blocked by the hardcoded array
2. All-posts dashboard + moderation view — visibility into what users post + manual hide for bad content
3. Share-card generation — for featuring posts externally
4. Admin invites — useful eventually but not day one

The spec follows this exact order. Each step is independently shippable: after Step 1, prompt management works; after Step 2, you can see and moderate posts; and so on. Don't feel pressure to finish all four before getting value from the earlier ones.

---

## Step 1 — Admin route shell + access guard

Before building any admin feature, set up the foundation. Everything in M3 lives behind this guard.

- Create `/admin` route in `src/App.tsx` (or wherever the router lives). All admin routes are nested under it: `/admin`, `/admin/prompts`, `/admin/posts`, `/admin/featured`, `/admin/admins`, etc.
- Build a `RequireAdmin` route component that:
  - Checks `useAuth()` for a signed-in user
  - Calls a `useIsAdmin()` hook that reads the user's `profiles.is_admin` flag (cache the result for the session — no need to re-query on every navigation)
  - If not signed in: redirect to sign-in with a return-to of the admin URL
  - If signed in but not admin: redirect to `/` (the regular app) with no error message (don't tell non-admins that admin exists)
- Build `src/screens/Admin/AdminLayout.tsx`:
  - Persistent left sidebar (mobile: top tabs) with sections: **Prompts**, **Posts**, **Featured**, **Admins**, **Back to app**
  - Neutral background (off-white `#F1EFE8`-ish per DESIGN.md), no day-color rotation
  - Top-right shows the current admin's name and a sign-out
- The regular consumer app has NO link to `/admin` for non-admins. Admins see a small "Admin" link in their profile settings.

Test: sign in as an admin, navigate to `/admin`, see the layout with empty section placeholders. Sign in as a non-admin, navigate to `/admin`, get redirected to `/`. Sign out, navigate to `/admin`, redirected to sign-in.

## Step 2 — Prompt + note management (PRIORITY)

This is the unblock for you and your teammate. Once this ships, the hardcoded arrays go away and you can manage prompts AND warm notes through the admin UI. Notes were already displaying in M2 (seeded into the DB then), but admins couldn't edit them.

### 2a — Migration: remove the hardcoded array

- The M1 `prompts` table is already correct (id, text, active, created_by, created_at).
- In M1, the client read prompts from `src/data/prompts.ts` (the hardcoded array). The DB had the 5 starter prompts seeded but the client wasn't actually using them yet. **Now flip the switch**: `assign_prompt_for_today()` already reads from the DB, but the M1 code may have a fallback or override. Find and remove any client-side hardcoded prompt fallback. The single source of truth is the `prompts` table.
- Delete `src/data/prompts.ts`. If anything imports it, replace with a DB query.

### 2b — Admin Prompts screen

Build `src/screens/Admin/Prompts.tsx`:

- Lists all prompts (active and inactive), with columns: text, status (active/inactive), created by, created at, times shown (count of `daily_assignments` rows referencing this prompt)
- Sort by created_at desc by default; allow sort by times-shown
- Each row has actions: **Edit**, **Deactivate** (or Activate if inactive)
- Top-right button: **+ New prompt**
- Empty state if no prompts exist (shouldn't happen post-seed, but handle it)

### 2c — Add/edit prompt flow

- "New prompt" opens a sheet/modal with:
  - Textarea for the prompt text (5–200 chars, validated client-side and via DB check constraint)
  - **Character counter and live preview** — show what the prompt will look like rendered on a Today screen (use a small 320px-wide preview card with a sample day's color)
  - Save / Cancel buttons
- "Edit prompt" opens the same UI pre-filled
- Edits to a prompt update the `text` field in place. Existing `daily_assignments` rows that reference this prompt will display the new text — that's intentional, since users' posts are linked to the prompt by ID and a prompt edit is essentially "we worded this better." If you ever need to *change the meaning*, deactivate the old one and create a new prompt instead.
- Deactivation sets `active = false`. Deactivated prompts won't be assigned to any new user, but existing assignments and posts are untouched.

### 2d — RLS already covers this

M1 already wrote the RLS policy: `admins write prompts`. Verify it's in place and the client correctly authenticates as an admin before writes.

Test cases:
- Add a new prompt, refresh, see it in the list
- Edit a prompt, confirm it shows the new text everywhere
- Deactivate a prompt, sign in as a regular user, confirm that prompt is never assigned (you may need to manipulate `daily_assignments` to test — easiest: deactivate ALL but one, sign in as a fresh user, confirm you only see that one)
- Try to create a prompt that's 4 chars or 201 chars, confirm validation prevents it

### 2e — Bulk import (optional, nice-to-have)

If you and your teammate already have a list of prompts in a Google Doc or text file, a bulk import is a small win. Add a "Bulk import" button that opens a textarea: one prompt per line, paste, submit, all created at once. Skip if it feels like scope creep — manual entry is fine.

**After Step 2 ships, you can stop and use the admin to write more prompts and notes before continuing M3.** The other steps are not blocking.

### 2f — Notes management (mirror of prompt management)

The `notes` table was created in M2.1 with a starter pool seeded and the display code already shipping notes from the database. M3 adds the admin UI to manage them, mirroring prompt management.

Build `src/screens/Admin/Notes.tsx`:
- Tabs at top: **Empty state notes** | **Completed state notes** (each lists one pool)
- Columns per row: text, day-of-week tag (or "any"), status, created by, created at, times shown
- Same edit/deactivate/+ New flow as prompts
- "New note" sheet has:
  - Textarea (3–140 chars)
  - Pool selector (radio: empty state / completed state)
  - Day-of-week selector (radio: any day / Mon / Tue / Wed / Thu / Fri / Sat / Sun)
  - Live preview using the `WarmNote` component on a sample Today screen background
- Same RLS policy as prompts (admins-only writes), already in place from M2 migration
- Same audit logging pattern as prompts (`note_created`, `note_edited`, `note_deactivated`, `note_reactivated`) — the action types are already in the `admin_audit` check constraint
- Bulk import for notes works the same as prompts. Useful: you and your teammate might want to brainstorm 30+ notes at once in a doc, then paste them in.

### 2g — Hardcoded fallback cleanup

M2.1 left `src/data/notes.ts` in place as a reference (matching the prompts pattern). Delete it now that the admin can manage notes via the DB. The single source of truth is the `notes` table.

---

## Step 3 — All-posts dashboard + moderation view

Visibility into what users post, with the ability to hide problematic content. This is the manual moderation layer; automated moderation comes in M4.

### 3a — The Posts screen

Build `src/screens/Admin/Posts.tsx`:

- Lists all posts across all users, newest first
- Each row shows: post date, user display name (linked to a future user-detail view; for now just text), the prompt that was assigned, the post text/photo, share permission badges (anonymous-allowed, named-allowed, or "fully private")
- Default view: today's posts
- Filter tabs: **Today**, **This week**, **All time**, **Hidden**
- Filter pills (additive): **Shared anonymously**, **Shared with name**, **Has photo**, **Has text only**, **Hidden**
- Search: text contains... (simple ILIKE query on `posts.text`)
- Pagination: 50 per page, infinite scroll or "Load more" button. Don't try to render thousands at once.

### 3b — Per-post action sheet (re-uses the M1 design mock)

Clicking a post opens a drawer/sheet on mobile, side panel on desktop, with:
- Full post (text + photo if any)
- Metadata: who, when, which prompt, which day's palette
- Share permission badges as toggles you can READ but not edit (admins don't unilaterally grant user permissions — that's a user decision)
- Action buttons:
  - **Hide post** (M3) — sets `moderation_status = 'hidden'`. The user's view of their own post shows "This post has been hidden by a moderator." Admin can unhide.
  - **Feature on website** (M3, see Step 4) — only enabled if the user has granted at least anonymous share permission
  - **Copy public share link** (M3, Step 4) — same constraint
  - **Save as image** (M3, Step 4) — generates the share card
  - **Flag for review** (M4) — placeholder button, disabled in M3

### 3c — Hiding posts: user-side behavior

When `posts.moderation_status = 'hidden'`:
- The user's own Today/History views show the post location with placeholder text: "This post has been hidden by a moderator. Contact support if you think this is a mistake."
- The post is not deleted; just not displayed normally
- The streak it contributed to is preserved (don't punish the user for the hide; streak math doesn't change)
- Photo (if any) is hidden from signed-URL access — adjust the storage RLS to require `moderation_status != 'hidden'` for the photo owner

Migration: `supabase/migrations/0005_admin_hide_posts.sql` — update the `posts` RLS to reflect the hidden state, plus a security-definer function `hide_post(post_id, reason)` and `unhide_post(post_id)` callable by admins only. Both log to `admin_audit` with a new action type ('post_hidden', 'post_unhidden').

### 3d — Admin audit extension

The `admin_audit` table from M1 currently only logs promotions/demotions. Extend it to log:
- `post_hidden`, `post_unhidden` (Step 3)
- `post_featured`, `post_unfeatured` (Step 4)
- `prompt_created`, `prompt_edited`, `prompt_deactivated` (Step 2, retroactively)

The `target_user` column was designed for user IDs. For post/prompt events, use a polymorphic approach: add `target_type` ('user', 'post', 'prompt') and `target_id` (uuid). Migrate the existing column. Or simpler: keep `target_user` for user events, add `target_post` and `target_prompt` nullable columns. Pick the simpler one.

### 3e — Basic metrics widget

Top of the Posts screen, show four numbers:
- Total users (count of profiles)
- Posts today
- Posts this week
- Hidden posts (admin awareness)

These are reassuring quick-glance numbers. No charting, no graphs — just numbers in pills.

Test:
- See all posts across users you've created during M1/M2 testing
- Hide a post, sign in as that user, confirm they see the hidden message
- Unhide it, confirm it reappears
- Filter by "Shared with name" and confirm the filter works

---

## Step 4 — Featured posts + share-card generation

Now you can publish curated posts externally.

### 4a — The featured_posts table is already in M1 schema

Use the existing `featured_posts` table from M1's SCHEMA.md. It has `post_id`, `display_mode` ('anonymous' or 'with_name'), `featured_by`, `featured_at`, `unfeatured_at`.

### 4b — Feature/unfeature actions

In the per-post action sheet:
- **Feature on website** opens a sub-flow:
  - If the post has both share permissions enabled, ask: "Display anonymously or with [user]'s name?" → user picks
  - If only one is enabled, use that one without asking
  - If neither is enabled, the button is disabled with a tooltip explaining the user hasn't opted in
- Creates a `featured_posts` row, logs to `admin_audit`
- A featured post shows a "Featured" badge in the admin posts list

A separate `/admin/featured` screen lists currently-featured posts with quick-unfeature buttons.

### 4c — Public share link

Each featured post gets a public URL: `/p/{post_id}`. This is the M5 public share page, but the URL needs to exist now even if the page itself is minimal. For M3, the page can be a simple read-only render of the post:
- The prompt text
- The post content (text + photo)
- The author name (only if `display_mode = 'with_name'`)
- The day's color palette as the background
- "Created with One Small Thing" footer link

The full polished public page with social meta tags is M5. For M3, just make it render.

"Copy public share link" in the action sheet copies `https://yourapp.com/p/{post_id}` to clipboard.

### 4d — Share-card image generation

Build `src/components/ShareCard.tsx` — a square (1080×1080 for Instagram-ready output) rendered version of a post:
- Background: the day's color palette and decorative shapes
- Foreground: prompt at top (small, like a label), post text below (large, like a quote)
- Author name at bottom: "— [Name]" if `with_name`, omitted if anonymous
- App name in a corner: "ONESMALLTHING.APP" in small caps

Generation approach: render `ShareCard` to a hidden DOM node, use **html-to-image** (the one package added in M3 per STACK.md) to convert it to a PNG blob, trigger download.

The action sheet's "Save as image" opens a small preview with controls:
- Color palette switcher (5 swatches — keep the post's actual day color selected by default, but admin can override)
- Toggle: show author name (only enabled if `display_mode = 'with_name'`)
- "Download PNG" button

This was specifically mocked in the design phase. Match that mock.

### 4e — Image generation runs client-side

Don't build a server-side rendering pipeline. html-to-image does it in the browser, which is free, fast, and gives the admin instant preview. The only downside is fonts have to be loaded into the page (they already are; the admin app uses the same fonts).

Test:
- Feature a post with anonymous permission, confirm "with name" option is disabled
- Feature with both, choose with-name, confirm /p/{id} shows the name
- Generate a share card, verify the PNG downloads, verify it looks like the mock
- Unfeature, confirm /p/{id} now returns a 404 or "not found" page

---

## Step 5 — Admin invites (the in-app version)

Last priority. Two admins (you + teammate) works fine for v1 via the bootstrap email list. This step is the UI to invite a third.

### 5a — The screen

Build `src/screens/Admin/Admins.tsx`:
- Lists current admins: name, email, when they became admin, demote button
- Bootstrap admins get a small lock badge — "Permanent (bootstrap list)" — to indicate they can't be permanently demoted via UI
- "Invite admin" button → opens a small form: email input, optional note, send

### 5b — The invite

Already specified in SCHEMA.md (`admin_invites` table and `invite_admin()` function from M1). The UI calls the existing RPC.

Behavior:
- If the invitee already has an account, they're promoted immediately
- If not, a row sits in `admin_invites` and the trigger promotes them on first sign-in
- The admin who sent the invite sees a confirmation: "Invited. They'll be admin after their next sign-in."
- No email is sent — the inviter is expected to message the person out-of-band. (Sending an email requires a configured SMTP provider; defer to when you have one.)

### 5c — Demote

- "Demote" button calls the `demote_admin(target_id)` RPC from M1
- Confirmation modal: "Demote [name]? They'll lose admin access immediately."
- Last-admin guard already in the DB function — surface its error message nicely if hit

### 5d — Audit log view

`/admin/admins/audit` or a tab on the admins screen: read-only list of `admin_audit` entries, newest first. Filter by action type. Useful for "wait who demoted Bob?"

Test:
- Invite an email that doesn't have an account yet — confirm row in `admin_invites`
- Sign in as that email, confirm auto-promotion + audit log entry
- Demote them, confirm they lose access on next page load
- Try to demote yourself when you're the only non-bootstrap admin — confirm the last-admin guard works

---

## Acceptance criteria for M3 done

- [ ] `/admin` route is gated by `is_admin` check; non-admins are bounced silently
- [ ] Admin can add, edit, deactivate prompts via the UI
- [ ] Admin can add, edit, deactivate warm notes via the UI (both pools, day-of-week tagging works)
- [ ] Hardcoded prompt array is removed; DB is the only source
- [ ] Hardcoded notes array is removed; DB is the only source
- [ ] All posts view shows every user's posts with filters and search
- [ ] Hiding a post works and the user sees a placeholder
- [ ] Featuring a post creates the `/p/{id}` public route
- [ ] Share-card PNG download works and matches the mocked design
- [ ] Admin invite flow promotes new admins by email
- [ ] Demote flow works with last-admin guard
- [ ] All admin actions appear in the audit log
- [ ] Bootstrap admins are visually distinguished in the admins list
- [ ] Admin UI has its own neutral visual identity (not the day-color rotation)
- [ ] Deployed and verified end-to-end

## Out of scope for M3 (defer)

- Automated moderation (M4)
- Share permission toggles in the composer (M4 — currently default false in M1)
- The polished public share page with social meta tags (M5)
- Per-user admin views (drilling into a single user's full history)
- Email notifications to invitees (needs SMTP provider)
- CSV/JSON export of posts
- Admin onboarding tour for new admins
- Analytics dashboard beyond the four metrics in Step 3e

## Notes for Claude Code

- M3 introduces **html-to-image** as a new package — only one new dependency for the entire milestone. Don't add others without asking.
- All admin actions that change data should call **security-definer RPCs**, not direct table writes. This keeps the access control inside the database where it can be audited. RLS protects against client-side mistakes, but the RPCs are the intended API.
- The `/p/{id}` public route is built in M3 but the polish (meta tags, og:image, etc.) is M5. Build the minimum: render the post, respect the display mode, look reasonable on mobile and desktop.
- Match the mocks for the action sheet and share card generator — they were intentionally designed in the spec phase.
