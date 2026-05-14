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
- Calculated at post-time:
  - If user posted yesterday OR used a grace day yesterday → streak +1
  - If user did not post yesterday AND did not have grace available → streak resets to 1 (today still counts)
- Streaks display from day 1 (so a user who just posted for the first time sees "1 day streak", not "0")
- Streak visualization shifts subtly at milestones (3, 7, 14, 30, 60, 100 days) — flame icon gains a small badge or animation. Specifics TBD in M2.

## Grace days

- Each user gets **one grace day per calendar week** (Mon-Sun, in the user's timezone)
- Reset at midnight local time on Monday
- Grace is consumed automatically when a user misses a day but has one available — they don't choose to use it
- After consumption, on next post, show a one-time toast: "We used your grace day for [missed day] — your streak is safe"
- If they miss a second day in the same week with no grace, streak breaks
- Track via `grace_days_used` table: `user_id`, `week_start_date`, `used_for_date`

## Reminders

- Push notification at user-chosen time (default 7:00pm local)
- Sent ONLY if the user has not posted that day yet
- One reminder per day max
- After 3 consecutive missed reminders (user opened the notification or app within 30 mins but did not post), back off to every other day until they post again, then resume normal cadence
- User can change time or turn off in settings
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
- Admin review queue table
- Admin can: approve, hide (post is removed from user's view too, with explanation), or ignore (false positive)

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
