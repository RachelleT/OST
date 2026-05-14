# Milestone 2 — Reminders + Grace Day

Goal: the app sends a gentle, well-timed daily push notification (only if the user hasn't posted), and the grace-day mechanic works correctly across timezones so missing one day a week doesn't break a streak.

Prerequisite: M1 is complete, deployed, and the core loop works end-to-end.

Build in this order. The timezone work (Step 1) comes first because everything else depends on it being correct.

## Why this milestone is ordered the way it is

M1 deliberately punted on timezones — `assign_prompt_for_today()` uses `current_date` (server time, UTC) with a "TODO" comment, and the M1 streak logic treats "yesterday" as a naive date. That was fine for a single-user test. M2 cannot punt: a reminder fired at the wrong hour, or a grace day that resets on the wrong day, is exactly the kind of bug that makes users distrust the app. So Step 1 fixes the timezone foundation, and everything else builds on it.

---

## Step 1 — Timezone foundation

The principle: **every "what day is it for this user" decision uses the user's stored timezone, never server time.**

- The user's timezone is already in `profiles.timezone` (set at signup, defaults to browser-detected). Confirm M1 actually populated this. If M1 left it as 'UTC' for everyone, add a one-time fix: on next app open, detect `Intl.DateTimeFormat().resolvedOptions().timeZone` and update the profile if it differs.
- Create `src/lib/date.ts` with these helpers (if M1 didn't already):
  - `userToday(timezone): string` — returns the current date (YYYY-MM-DD) in the user's timezone
  - `userYesterday(timezone): string`
  - `weekStart(date, timezone): string` — the Monday of the week containing `date`, in the user's TZ
  - `isSameUserDay(timestamp, timezone): boolean`
- **Update `assign_prompt_for_today()` in the database** to accept the user's timezone and compute "today" correctly. The function currently does `v_today date := current_date;` — change it to compute the date in the user's timezone. Pass the timezone from the client, or read it from the user's profile inside the function (preferred — one less thing the client can get wrong).
- Migration file: `supabase/migrations/0002_timezone_aware_dates.sql`

Test: set your profile timezone to something far from UTC (e.g. `Pacific/Auckland` or `America/Los_Angeles`), confirm the prompt rolls over at midnight *your* time, not UTC midnight.

## Step 2 — Grace day logic

Implement the full grace-day mechanic from PRODUCT.md. This was explicitly deferred from M1.

- A user has grace available this week if there is **no row** in `grace_days_used` for their `(user_id, weekStart)` where weekStart is the Monday of the current week in their timezone.
- Grace is consumed **automatically** — the user never chooses to use it. It's consumed when the streak calculation detects a missed day that would otherwise break the streak, AND grace is available.
- Build `src/lib/streak.ts` properly now (M1 had a simplified version). The full algorithm:
  ```
  on post submit:
    today = userToday(tz)
    yesterday = userYesterday(tz)
    last_post = most recent post date before today

    if last_post == yesterday:
      streak continues: current_streak += 1
    else if last_post < yesterday:
      // there's a gap. how big?
      missed_days = all dates strictly between last_post and today
      if missed_days has exactly 1 day AND grace available for that day's week:
        consume grace (insert grace_days_used row for that missed day)
        streak continues: current_streak += 1
        flag: show "grace used" toast on next render
      else:
        streak breaks: current_streak = 1
    else if last_post == today:
      // editing today's post, streak unchanged
      no-op

    longest_streak = max(longest_streak, current_streak)
  ```
- The streak calculation should happen server-side in the `submit_post` RPC (transactional — post insert + streak update + grace consumption must all succeed or all fail together). If M1 did the post insert client-side, this is the milestone to move it into the RPC.
- Migration: add/update the `submit_post` function in `supabase/migrations/0003_submit_post_with_grace.sql`
- The "grace used" toast: after a post that consumed grace, the completed-state screen shows a one-time dismissible toast: "We used your grace day for [weekday] — your streak is safe." Store a `grace_toast_pending` flag (can be client-side state passed back from the RPC response; doesn't need to persist).

Test cases — verify each:
- Post two days running → streak = 2
- Skip exactly one day, post again, grace available → streak continues, grace consumed, toast shows
- Skip one day, post again, grace already used this week → streak resets to 1
- Skip two days in a row → streak resets to 1 (grace only covers a single day)
- Skip one day in week A (grace used), then post every day, then skip one day in week B → grace available again in week B (it reset Monday)
- Edit today's post → streak unchanged, no grace consumed

## Step 3 — Web Push: subscription flow

Get the browser subscription working before worrying about sending.

- Generate VAPID keys (one-time). Use the `web-push` library's `generate-vapid-keys` command, or any VAPID generator. Store the **public** key as an env var (`VITE_VAPID_PUBLIC_KEY`) and the **private** key as a Supabase Edge Function secret (never in client code, never in the repo).
- The M1 service worker (from `vite-plugin-pwa`) needs a push event handler. `vite-plugin-pwa` supports injecting custom service worker code — add a `push` listener and a `notificationclick` listener.
- `src/lib/push.ts`:
  - `isPushSupported()` — feature-detect
  - `getPushPermissionState()` — 'granted' | 'denied' | 'default'
  - `subscribeToPush()` — requests permission, subscribes via the service worker, saves the subscription to the `push_subscriptions` table
  - `unsubscribeFromPush()` — removes the subscription
- **iOS-specific handling**: web push on iOS only works for installed PWAs. Detect whether the app is running as an installed PWA (`window.matchMedia('(display-mode: standalone)').matches`). If the user is on iOS Safari and NOT installed, the notification settings UI should explain they need to "Add to Home Screen" first, with brief instructions, rather than showing a permission button that won't work.

Test: on Android Chrome, tap to enable notifications, confirm permission prompt, confirm a row appears in `push_subscriptions`. On desktop Chrome, same. On iPhone, confirm the "install first" message shows when not installed, and the real flow works once installed.

## Step 4 — Web Push: the permission ask

Where and how to ask matters — asking at the wrong moment gets you denied permanently.

- **Do NOT ask for notification permission on first load or during onboarding screen 3.** M1's onboarding collected a reminder *time* and stored it in localStorage; it did not ask for OS permission. Keep that separation.
- Ask for permission **after the user's first successful post**, on the completed-state screen. They've just experienced the core loop; now "want a daily nudge so you don't forget?" makes sense. One tap.
- If they dismiss it, don't ask again automatically — put an enable button in Settings instead.
- Move the reminder time from localStorage (M1's temporary home) into `profiles.reminder_time` now that there's a real backend reason for it.

Test: new user posts for the first time, sees the notification opt-in, accepts → permission granted + subscription saved + reminder_time persisted to profile.

## Step 5 — Scheduled sending (pg_cron + Edge Function)

This is the server-side job that actually sends reminders.

- Enable the `pg_cron` and `pg_net` extensions in Supabase (Dashboard → Database → Extensions). Both are free-tier available.
- Create a Supabase Edge Function `send-reminders`:
  - Runs every 15 minutes (cron schedule)
  - For each user: compute their current local time from `profiles.timezone`. If their `reminder_time` falls within the last 15-minute window AND they have not posted today (no `posts` row for `userToday(tz)`) AND they have a `push_subscription` AND they're not in a back-off period → send a push notification
  - Use the `web-push` library inside the Edge Function, signing with the VAPID private key (from Edge Function secrets)
  - Log each send to a `reminder_log` table (see SCHEMA update) so back-off logic and debugging have data
- The cron job calls the Edge Function. Set it up via SQL:
  ```sql
  select cron.schedule(
    'send-reminders-every-15min',
    '*/15 * * * *',
    $$ select net.http_post(
        url := '<edge-function-url>',
        headers := '{"Authorization": "Bearer <anon-or-service-key>"}'::jsonb
       ) $$
  );
  ```
- Migration: `supabase/migrations/0004_reminder_cron.sql`

Test: set your reminder_time to 5 minutes from now, don't post, wait → receive the notification. Then post before the time, wait → no notification.

## Step 6 — "Not annoying" rules

The back-off and suppression logic from PRODUCT.md.

- **Never send if already posted today** — covered in Step 5, but double-check the query.
- **One reminder per day max** — the `reminder_log` table prevents double-sends.
- **Back-off after ignored reminders**: track in `reminder_log` whether a reminder led to a post that day. After 3 consecutive reminders that did NOT lead to a post, switch that user to every-other-day reminders. Once they post again (with or without a reminder), reset to normal daily cadence.
- **Notification copy**: gentle, not naggy. Use the day's prompt as the hook, not the streak as a threat.
  - Good: "Today's prompt is waiting 🌱" / body: the actual prompt text
  - Bad: "Don't lose your 12-day streak!" / "You haven't posted today!"
  - Rotate a small set of gentle title variations so it doesn't feel robotic.
- **notificationclick** opens the app directly to the Today screen.

Test: ignore reminders 3 days running → 4th day, confirm no reminder (it's an off day in the every-other-day cadence). Post → cadence resets.

## Step 7 — Settings + streak milestones

Wire up the remaining UI.

- **Settings screen** (M1 had a placeholder): real controls for reminder time (writes to `profiles.reminder_time`), a notification on/off toggle (subscribes/unsubscribes), timezone (editable, defaults to detected).
- **Streak milestones** (PRODUCT.md mentioned these as "TBD in M2"): at 3, 7, 14, 30, 60, 100 days, the flame icon in the streak pill gets a subtle treatment — a small ring, a color shift, or a tiny "✨" — and the completed-state screen shows a one-time "🎉 7 day streak!" acknowledgment. Keep it tasteful, not a confetti explosion. This is also where the M1 yellow celebration color can finally be used.
- The "see you tomorrow" card on the completed screen (M1 showed placeholder reminder time text) now shows the *real* reminder time from the profile, or "Reminders off" with a link to turn them on.

Test: click through settings, change reminder time, confirm it persists and the next reminder respects it. Hit a milestone day, confirm the acknowledgment shows once.

## Step 8 — Deploy + verify

- Deploy the Edge Function (`supabase functions deploy send-reminders`) — note this needs the Supabase CLI OR can be done via the dashboard's Edge Functions UI. Since this project is dashboard-only, **use the dashboard Edge Functions editor** to create and deploy the function. Paste the function code there.
- Run the cron setup SQL via SQL Editor.
- Add `VITE_VAPID_PUBLIC_KEY` to Vercel env vars and redeploy the frontend.
- Add the VAPID private key and any other secrets to Supabase Edge Function secrets via the dashboard.
- Full end-to-end test on a real phone: install PWA, post, enable notifications, set reminder 5 min out, skip posting, receive reminder, tap it, land on Today screen.

## Acceptance criteria for M2 done

- [ ] Prompt rollover and "today" respect the user's timezone, not UTC
- [ ] Grace day: missing exactly one day per week keeps the streak; the toast explains it
- [ ] Grace day resets every Monday in the user's timezone
- [ ] Missing two days, or a second day in the same week, breaks the streak
- [ ] Web push subscription works on Android Chrome and desktop Chrome
- [ ] iOS shows the "install first" guidance when not installed; works when installed
- [ ] Permission is asked after first post, never on cold load
- [ ] Reminders actually arrive at the user's chosen local time
- [ ] No reminder is sent if the user already posted that day
- [ ] Back-off kicks in after 3 ignored reminders, resets after a post
- [ ] Notification copy is gentle (prompt-as-hook, not streak-as-threat)
- [ ] Tapping a notification opens the Today screen
- [ ] Settings screen controls reminder time, notification on/off, timezone
- [ ] Streak milestones show a tasteful one-time acknowledgment
- [ ] All deployed; verified end-to-end on a real phone

## Out of scope for M2 (defer)

- Email reminders (v1 is push-only, possibly forever)
- Admin dashboard (M3)
- Moderation (M4)
- Share permission toggles (M4)
- Quiet hours / do-not-disturb windows beyond the single reminder time
- Multiple reminders per day
- Per-prompt-type reminder customization
- Rich notifications (images, action buttons) — keep it a simple title + body for now

## Notes on the dashboard-only constraint

M2 introduces Edge Functions, which are normally deployed via the Supabase CLI. Since this project stays dashboard-only:
- Edge Functions are created and edited in the Supabase Dashboard → Edge Functions section
- Claude Code writes the function code into `supabase/functions/send-reminders/index.ts` in the repo (for version control), then tells the user to copy it into the dashboard editor and deploy from there
- Function secrets (VAPID private key) are set in the dashboard under Edge Functions → Secrets
- The cron SQL is run via the SQL Editor like every other migration

If the dashboard Edge Function workflow proves too painful, that's the one place where installing the Supabase CLI might be worth reconsidering — but try the dashboard route first.
