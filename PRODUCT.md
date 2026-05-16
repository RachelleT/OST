# Product Spec

## Core loop

1. User opens the app on a given day
2. They see exactly one prompt — randomly selected for them, stable for that day
3. They respond with text (≤280 chars) and/or a photo
4. After posting, the screen shifts to a "done for today" state showing their post back to them and the next reminder time
5. They build a streak; missing a day uses a grace day (one per calendar week); missing without grace breaks the streak
6. They can browse their history any time

## Prompts

- Stored in `prompts` table with: `id`, `text`, `created_by`, `active`, `created_at`
- In M1: hardcoded array in `src/data/prompts.ts`. Five starter prompts (see end of this doc)
- In M3: admin UI to add/edit/deactivate prompts; reads from database
- Only `active = true` prompts are eligible for assignment

### Daily assignment algorithm

Each user gets one prompt per day, randomly selected, but **stable** (re-opening the app on the same day shows the same prompt; user can't refresh for a different one).

```
prompt_for(user_id, date) =
  candidates = prompts where active = true
                AND id NOT IN (last 30 prompts shown to this user)
  if candidates is empty, fall back to all active prompts
  seed = hash(user_id + date_iso_string)
  return candidates[seed % len(candidates)]
```

Generated lazily when the user opens the today screen. Stored in `daily_assignments` table so subsequent opens read from there, not from re-running the algorithm.

## Warm notes

A small, human touch on the Today screen — a little line of encouragement, observation, or wry humor that sits below the post composer (empty state) or near the "see you tomorrow" card (completed state). The goal: make the app feel like a person wrote it, not a productivity tool.

- Two separate pools: `empty_state_notes` (shown before the user has posted today) and `completed_state_notes` (shown after).
- One note per user per day, **deterministic and stable** — re-opening the app shows the same note all day. Same algorithm pattern as prompts: hash(user_id + date) selects from the pool. This avoids "slot machine" feeling where users refresh to chase a note they liked.
- Notes are optionally tagged with `day_of_week` (0=Mon..6=Sun, or null for "any day"). If any day-tagged note matches today, prefer those over untagged ones. Falls back to untagged if none match. Lets you write Monday-specific or Sunday-specific lines.
- Same admin write path as prompts. You and your teammate add notes in the admin UI (M3). For M2.1 (the build that introduces them) they're hardcoded in `src/data/notes.ts` similar to how prompts started in M1.
- **Tone guidance for note authors** (you and your teammate):
  - Warm > performative. "Look at you, showing up" beats "Great job!"
  - Permission > pressure. "Permission to keep it short" beats "You can do it!"
  - Observation > affirmation. "Wednesdays are secretly the bravest day" beats "You're amazing!"
  - Sometimes funny is the right answer. "Brain still warming up? Same." is a valid note.
  - Avoid: comparisons to other users, references to streak length, anything that sounds like a self-help book, generic motivational quotes.
- Notes are NOT dismissable. They're small enough that an X button would create more friction than the note itself causes.
- A note is shown alongside, never replacing, anything else on screen. It is purely additive warmth.

### Starter pool

For M2.1, seed with these — they live in `src/data/notes.ts`:

**Empty state notes (untagged unless noted):**
- "There's no wrong answer to this one."
- "Permission granted to keep it short."
- "Whatever you write is going to be the right thing today."
- "You showed up. That's already the hard part."
- "Sleepy thoughts are honest thoughts."
- "Brain still warming up? Same."
- "Permission to make this one boring."
- "Wednesdays are secretly the bravest day." (day_of_week = 2)
- "Sunday is just Monday in soft pajamas." (day_of_week = 6)
- "Mondays earn their reputation. Be gentle." (day_of_week = 0)

**Completed state notes:**
- "Look at you, showing up."
- "Nice. That's today done."
- "One more honest moment in the bank."
- "That counts."
- "Stick around tomorrow."
- "Quiet wins are still wins."

## Posting

- Text input, hard limit 280 characters. Counter visible. Posts cannot exceed.
- Photo upload optional, JPEG/PNG/WebP, ≤5MB, resize client-side to max 1600px on longest edge before upload
- Both text and photo can coexist on one post
- At least one of text OR photo is required to submit
- Once submitted, the post is editable for 5 minutes, then locked
- One post per user per day. If they try to post again on the same day, they edit the existing one
- The post is associated with the prompt that was assigned to the user that day

## Streaks

- `current_streak` = consecutive days posted (or used grace day) up to today
- `longest_streak` = best ever
- All "day" calculations use the **user's timezone** (`profiles.timezone`), never server time. "Yesterday," "today," and the week boundary are all computed locally to the user.
- Calculated server-side at post-time, inside the `submit_post` RPC, transactionally with the post insert:
  - If user posted yesterday OR used a grace day yesterday → streak +1
  - If user did not post yesterday AND did not have grace available → streak resets to 1 (today still counts)
- Streaks display from day 1 (so a user who just posted for the first time sees "1 day streak", not "0")
- **Streak milestones** at 3, 7, 14, 30, 60, 100 days: the flame icon in the streak pill gets a subtle treatment (a ring, a color shift, or a small sparkle — tasteful, not confetti), and the completed-state screen shows a one-time acknowledgment ("🎉 7 day streak!"). This is the one place the bright yellow celebration color is used. Implemented in M2 Step 7.

## Grace days

- Each user gets **one grace day per calendar week** (Monday–Sunday, in the user's timezone)
- Reset at midnight local time on Monday
- Grace is consumed **automatically** when a user misses a single day but has one available — they don't choose to use it. It is consumed inside the `submit_post` RPC when the streak calculation detects a one-day gap that grace can cover.
- Grace only ever covers **a single missed day**. Missing two or more consecutive days breaks the streak regardless of grace.
- After consumption, on next post, show a one-time dismissible toast: "We used your grace day for [weekday] — your streak is safe"
- Track via `grace_days_used` table: a row exists for `(user_id, week_start)` if grace has been used that week. The unique constraint on `(user_id, week_start)` enforces one-per-week at the database level.
- Full algorithm and test cases: see MILESTONE_2.md Step 2.

## Reminders

- Push notification at user-chosen time (default 7:00pm local), stored in `profiles.reminder_time`
- Sent ONLY if the user has not posted that day yet (checked against `userToday` in their timezone)
- One reminder per day max — enforced by the unique constraint on `reminder_log(user_id, sent_for_date)`
- Sent by a `pg_cron` job (every 15 min) that calls the `send-reminders` Edge Function
- After 3 consecutive reminders that did not lead to a post that day, back off to every-other-day cadence until the user posts again, then resume normal daily cadence. Tracked via `reminder_log.led_to_post`.
- **Permission is requested after the user's first successful post**, never on cold load or during onboarding. If declined, an enable button lives in Settings.
- **iOS**: web push only works for installed PWAs. If the user is on iOS and hasn't installed the app, Settings explains they need to "Add to Home Screen" first.
- Notification copy is gentle — the day's prompt is the hook, not the streak as a threat. "Today's prompt is waiting 🌱" not "Don't lose your streak!"
- Tapping a notification opens the Today screen.
- User can change the time or turn reminders off entirely in Settings.
- Web Push API only. No email reminders in v1.

## Privacy & sharing

Posts are private by default. Two independent toggles per post, both default OFF:

- **Allow anonymous use**: admin may feature this post on external surfaces (website, social media share images) without the user's name
- **Allow with my name**: admin may feature this post with the user's display name attached

A post with anonymous=true and named=false can be featured but only without identifying the author.
A post with both true gives admin the choice at share time.
A post with both false is fully private — admin can see it (for moderation) but cannot publish it anywhere.

Users can toggle these on past posts from the history view at any time. Revoking permission on a previously-featured post triggers an admin notification.

## Moderation

Two-layer system. Build the manual layer in M3, automated in M4.

**Automated (runs on every post submit, M4):**
- Text → OpenAI Moderation endpoint. Flags: hate, harassment, sexual, self-harm, violence
- Image → Google Cloud Vision SafeSearch. Flags: adult, racy, violence
- If flagged at "high" confidence: post is held, user sees "Reviewing your post — this usually takes a few minutes" message
- If flagged at "medium": post goes through but enters review queue
- If clean: published immediately

**Manual (M3+):**
- Admin posts dashboard shows every post across all users with search/filter
- Admin can hide any post via the `hide_post` RPC. Hidden posts:
  - Are not visible in any normal view, including the author's own Today/History
  - Author sees a placeholder: "This post has been hidden by a moderator. Contact support if you think this is a mistake."
  - The streak it contributed to is preserved — don't punish the author retroactively
  - The photo (if any) becomes inaccessible via signed URL
  - Can be unhidden by an admin at any time
- All hide/unhide actions logged to `admin_audit`

## Admin

Two admin users at launch (you and your teammate). Identified by an `is_admin = true` flag on the user profile.

### Becoming an admin

Three paths:

**1. Bootstrap list (you and your teammate, day one).**
The `config` table holds a comma-separated list of admin emails in the `bootstrap_admin_emails` key. Any user whose email is in this list is auto-promoted to admin on every sign-in. This is "always-on": even if a bootstrap admin is demoted, they'll be re-promoted on next sign-in. This is your permanent escape hatch — you can never lock yourself out while your email is in this list.

The bootstrap list is edited via SQL Editor (see SETUP.md Step 6), not through the app. It's an intentionally awkward path to discourage casual changes.

**2. Admin invite (M3 onward).**
Any existing admin can invite another user to be admin by entering their email in the admin dashboard. This creates a row in `admin_invites`. If the invitee already has an account, they're promoted immediately. If not, they're promoted on their next sign-in. The invite is one-time consumed.

**3. Demotion is reversible.**
Admins can demote other admins (or themselves) from the admin dashboard. Demoted users are no longer admin until either re-invited or re-bootstrapped. The "last admin" demotion is blocked to prevent total lockout.

Every promotion and demotion is logged to `admin_audit` with the actor, target, and reason.

### Admin capabilities

- See all posts (own dashboard at `/admin`)
- Filter: today / this week / shared-anonymous / shared-named / review queue
- Per-post actions: feature on website, copy public share link (only if shareable), generate share card image, send to review queue, hide post
- Manage prompt pool (add/edit/deactivate)
- Manage admins: invite by email, demote, see audit log
- See basic metrics: total users, posts today, posts this week, streak distribution

Admin actions never expose post content beyond the share permissions the user granted. If admin wants to feature a non-shared post, they must contact the user out of band.

## Auth

- **Magic link email only in v1**
- Supabase Auth handles it (free tier covers this)
- No password fields anywhere
- On first sign-up, user picks display name (3-30 chars, alphanumeric + spaces) and optionally a timezone (default detected from browser)
- No email verification step beyond the magic link itself (clicking it is the verification)

## Onboarding

3-screen intro (see DESIGN.md for visuals):
1. Welcome + tagline
2. How it works (4 bullets: one prompt/day, 280 chars or photo, streaks + grace day, private by default)
3. Pick reminder time + enter email for magic link

After magic link, land directly on the today screen. No empty-state friction.

## Settings

Available from the profile tab:
- Display name
- Reminder time (or off)
- Timezone
- Notification preferences (which channels — currently only push)
- Sign out
- "Delete my account" → email link to admin (manual in v1; UI button comes later)

## Starter prompt pool

For M1, hardcode these five:

1. What's something small that made you smile today?
2. Show me where you are right now.
3. If today was a song, what would it be?
4. What did you learn this week?
5. What are you carrying into next week?

These give a mix of: sensory ("show me where you are"), reflective ("what did you learn"), playful ("if today was a song"), prospective ("carrying into next week"), and gratitude-adjacent ("made you smile"). Don't worry about repetition with only 5 — the algorithm avoiding last-30 won't trigger until the pool is larger. In M3 the admins will write more.
