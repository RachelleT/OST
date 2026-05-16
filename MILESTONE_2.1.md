# Milestone 2.1 — Warm notes on the Today screen

A small follow-on to M2. M2 shipped the reminders/grace/timezone work; this adds a soft warm note to the Today screen so the empty space below the composer (and above the "see you tomorrow" card in the completed state) feels less utilitarian.

This is intentionally scoped small — it should be one focused build session, not a full milestone. The notes pool, mechanic, and component are all simple. Total estimate: half a day if everything goes smoothly.

Prerequisite: M2 complete (timezone helpers exist; the Today empty + completed states are wired up).

## Why this is M2.1 and not M3

The display layer is a tiny addition to the Today screen — same character as M1's hardcoded prompts. The admin UI to manage notes belongs in M3 alongside prompt CRUD (already specced there in M3 Step 2f). So:
- **M2.1**: ship the *display* with a hardcoded notes pool baked into the code
- **M3 Step 2**: build the admin CRUD UI; delete the hardcoded file once DB-backed editing works

Build M2.1 now so the warmth is in front of real users while M3 is still being built.

## Build steps

### Step 1 — Migration: create the `notes` table

- File: `supabase/migrations/0005_notes_table.sql`
- Create the `notes` table per SCHEMA.md, including the RLS policies (anyone reads active, admins write)
- Extend `admin_audit` to include `target_note` column and the four new action types (`note_created`, `note_edited`, `note_deactivated`, `note_reactivated`)
- User runs the migration via Supabase SQL Editor
- Verify the table appears in Table Editor

### Step 2 — Seed the starter pool

- File: extend `supabase/seed.sql` (or a new `supabase/migrations/0006_seed_notes.sql` if you prefer to keep seeds in migrations now that the file has grown)
- Insert the 16 starter notes from PRODUCT.md "Starter pool" — 10 empty_state notes (with the 3 day-of-week-tagged ones), 6 completed_state notes
- User runs via SQL Editor
- Verify: 16 rows in `notes`, 3 with non-null `day_of_week`

### Step 3 — Hardcoded fallback for the display

This mirrors how M1 handled prompts. The display code reads from the database, but a `src/data/notes.ts` file holds the same starter pool as an explicit reference. M3 will delete this file once admin CRUD is wired up.

- Create `src/data/notes.ts` exporting two arrays, one per pool, matching the seed data verbatim
- This file's purpose is documentation — if the DB seed ever needs to be re-run on a fresh project, copy from here

### Step 4 — Note selection helper

- Create `src/lib/notes.ts` exporting `noteForToday(userId, date, pool, timezone)`:
  ```ts
  async function noteForToday(
    userId: string,
    date: Date,
    pool: 'empty_state' | 'completed_state',
    timezone: string
  ): Promise<Note | null>
  ```
- Algorithm:
  1. Compute day-of-week for `date` in the user's timezone (Mon=0..Sun=6) using the M2 timezone helpers
  2. Query `notes` where `pool = pool AND active = true`
  3. Separate results into "day-tagged matches" (where `day_of_week = today_dow`) and "untagged" (`day_of_week IS NULL`)
  4. **Prefer day-tagged**: if day-tagged matches exist, the candidate set is *only* those. Otherwise, fall back to untagged.
  5. Hash `userId + date.toISOString().slice(0,10) + pool` to get a stable seed
  6. Return `candidates[seed % candidates.length]`
- Returns null if the pool is empty (shouldn't happen post-seed but handle gracefully — the UI just doesn't render the note)
- **Stable within a day**: re-running with the same args returns the same note. Different days → different note. Different users → likely different notes.
- **Different per pool**: a user sees one note before posting and (likely) a different one after.

Test cases:
- Same user, same date, same pool → same note every time
- Same user, two consecutive days → likely different note (not guaranteed but very likely with 10 candidates)
- Same user, same date, empty vs completed pool → different notes
- Two users, same date → likely different notes
- On a Wednesday, with the "Wednesdays are secretly the bravest day" tagged note active → that note is in the candidate set; if it's the only Wednesday-tagged note, it always shows on Wednesdays

### Step 5 — The `WarmNote` component

- Create `src/components/WarmNote.tsx`
- Props: `note: Note`, `pool: 'empty_state' | 'completed_state'`
- Visual spec (see DESIGN.md "Warm note card"):
  - Background: `rgba(255,255,255,0.55)`
  - Border radius: 18px
  - Padding: 14px 16px
  - Layout: emoji left (20px font, no background), text right
  - Text: note (13px, weight 500, color = `--day-text-on-bg`), tiny subtitle below ("a little note for today" — only show on `empty_state`; omit on `completed_state` since the tone is different)
- Emoji per pool (M2.1, simple):
  - `empty_state` → 🌱
  - `completed_state` → 👀
- No animation, ever. Static card. Honor `prefers-reduced-motion` would be irrelevant because there's nothing to reduce, but make sure no parent animation accidentally affects it.

### Step 6 — Wire into Today screen

- **Empty state** (`src/screens/Today.tsx` empty branch): below the submit button, with ~16px margin above and below. The bottom nav appears below the note.
- **Completed state** (`src/screens/Today.tsx` completed branch): between the user's post card and the "see you tomorrow" card. Same margins.
- Both calls use `noteForToday(user.id, new Date(), pool, profile.timezone)`. Render `<WarmNote>` only if a note is returned.
- The note fetch should not block the prompt or composer from rendering. Use a separate async load — the note can appear a beat after the rest of the screen. Don't show a loading skeleton; just render nothing until it arrives, then fade in if you want (single 200ms opacity transition is fine, no slide or scale).

### Step 7 — Verify end-to-end

- Open the app on the Today screen empty state: see a warm note below the submit button
- Post something: the note disappears, the user's post appears, and a *different* note (from `completed_state` pool) appears below it
- Refresh: same notes shown
- Sign in as a different user on the same day: different notes shown
- Manipulate your local date or wait until tomorrow: different notes shown
- If today is Wednesday and the Wednesday-tagged note is in the pool: confirm it has a higher chance of showing (mathematically: 1/N where N is the count of Wednesday-tagged active notes; on M2.1 launch that's 1/1 → always shows on Wednesdays for empty state)
- On a non-Wednesday: the Wednesday-tagged note never appears

## Acceptance criteria

- [ ] `notes` table exists in production database
- [ ] Starter pool of 16 notes seeded
- [ ] Warm note appears on the Today empty state, below the submit button
- [ ] Warm note appears on the Today completed state, between the post and "see you tomorrow"
- [ ] Empty and completed notes are independent (different pools, possibly different notes)
- [ ] Same user sees the same notes all day; refreshing doesn't shuffle
- [ ] Different users on the same day get different notes (probabilistically, since selection is hashed)
- [ ] Day-of-week-tagged notes appear on their assigned day; untagged work any day
- [ ] The card matches the design spec (soft transparent, no animation)
- [ ] No console errors; failing to load a note doesn't break the page
- [ ] Deployed to production

## Out of scope for M2.1 (already specced in M3)

- The admin UI to add/edit/deactivate notes (M3 Step 2f)
- Deleting the hardcoded `src/data/notes.ts` (M3 Step 2g — happens once admin CRUD is verified)
- Per-note custom emoji (M3 nice-to-have, mentioned but not promised)
- A "skip this note" or "thanks" tap interaction
- Translating notes (i18n is not on the roadmap)

## Notes for Claude Code

- This is a small, focused build. Do not expand scope. If something tempts you to "while we're here, let's also...", stop and ask.
- Database write: only the migration in Step 1. Everything else is read-only client-side.
- No new packages needed. M2 already brought in everything required.
- The selection algorithm must be **deterministic** — verify by calling it twice with the same args and confirming the same result. A common bug here is using `Math.random()` somewhere — don't.
- After M2.1 ships, ask the user to test it themselves before considering it done. The whole point is the *feel*, not just the function. They may want to revise the starter notes after seeing them in context.
