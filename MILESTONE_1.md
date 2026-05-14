# Milestone 1 — Core Loop

Goal: a person can sign in, see today's prompt, post a response, see it back, and view their history. Streak counts. No reminders, no admin, no moderation yet.

Build in this order. Don't skip steps. After each step, verify it works end-to-end before moving on.

## Step 1 — Scaffold

Run these in order. Stop and report if any step fails.

1. **Verify Node version**: run `node -v`. Should be v24.x (current LTS) or v22.x (maintenance LTS). If older than 22, tell the user to install Node 24 from nodejs.org. Don't proceed until confirmed.

2. **Create `.nvmrc`** at the project root containing the major version the user has (e.g. `24`). No quotes, no extra whitespace.

3. **Scaffold the Vite project in the current directory**:
   ```bash
   npm create vite@latest . -- --template react-ts
   ```
   This will prompt about the non-empty directory (because of the spec files). Choose to ignore/continue.

4. **Install the runtime dependencies** (single command, exactly as listed):
   ```bash
   npm install @supabase/supabase-js react-router-dom date-fns framer-motion browser-image-compression
   ```

5. **Install the dev dependencies**:
   ```bash
   npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa workbox-window
   ```

6. **Initialize Tailwind**:
   ```bash
   npx tailwindcss init -p
   ```
   Then edit `tailwind.config.js` and `src/index.css` per DESIGN.md (CSS variable scheme).

7. **Create the project structure** from STACK.md — empty folders for `components/`, `screens/`, `lib/`, `hooks/`, `data/`, and the `supabase/migrations/` folder.

8. **Create `.env.example`** with placeholder values. Do NOT create `.env.local` — that's the user's job, they have the real keys. Tell the user explicitly to create `.env.local` by copying `.env.example` and filling in their real Supabase URL and anon key from SETUP.md Step 1.

9. **Update `.gitignore`** to ensure `.env.local` and `node_modules/` are excluded (Vite's default usually has this; confirm).

10. **Create `supabase/migrations/0001_initial_schema.sql`** from SCHEMA.md. **Do not attempt to run it.** Tell the user to paste it into the Supabase SQL Editor (see SETUP.md Step 3) and confirm it ran without error.

11. **Create `supabase/seed.sql`** with the 5 starter prompts. Tell the user to run it via SQL Editor (SETUP.md Step 4).

12. **Confirm the user has completed SETUP.md Steps 1–6 before moving to Step 2.** Specifically: credentials configured, auth providers set, migration run, seed run, storage bucket created, bootstrap admin emails set.

13. **Run `npm run dev`** and verify a blank Vite starter page loads at `http://localhost:5173`. Replace the default Vite content with a simple "Hello" component to confirm your changes are picked up. This is the gate to Step 2.

### Quick sanity checklist before moving on

- [ ] `node -v` shows v24.x or v22.x
- [ ] `.nvmrc` file exists with that major version in it
- [ ] `package.json` lists all 11 packages from STACK.md
- [ ] `package-lock.json` exists
- [ ] `.env.example` is committed, `.env.local` is NOT in git
- [ ] `tailwind.config.js` exists
- [ ] `supabase/migrations/0001_initial_schema.sql` exists, user has run it
- [ ] `supabase/seed.sql` exists, user has run it, 5 prompts visible in Supabase Table Editor
- [ ] Storage bucket `post-photos` exists in Supabase with the two policies
- [ ] `npm run dev` works, shows your "Hello" content

## Step 2 — Auth

- `src/lib/supabase.ts` — create the client singleton
- `src/hooks/useAuth.ts` — subscribe to auth state, expose `user`, `isLoading`, `signIn(email)`, `signOut()`
- After a sign-in event fires (auth state changes to signed-in), call the `ensure_bootstrap_admin()` RPC once. This restores admin status for anyone in the bootstrap list. Fire and forget; don't block the UI.
- `src/screens/SignIn.tsx` — email input, submit calls `signIn`, shows "check your email" state
- Route guard: if no user, show SignIn. If user, show the app.
- Test: enter email, get magic link, click it, land back in the app authenticated
- Verify: after first sign-in with a bootstrap email, check the `profiles` table in Supabase dashboard — your row should have `is_admin = true`. Check `admin_audit` for a `bootstrap_auto` entry.

## Step 3 — Palette helper + DayBackground component

- `src/lib/palette.ts` — exports `dayPalette(date: Date): Palette` returning `{ bg, surface, accent, textOnBg, decorations }`. Hard-coded table per DESIGN.md.
- `src/components/DayBackground.tsx` — renders the day's SVG decorative shapes. Takes a palette as prop.
- Test by rendering all 7 days in a debug page to visually verify each matches the design

## Step 4 — Today screen (empty state)

- `src/screens/Today.tsx`
- Reads today's date, gets palette, applies CSS variables to a wrapper div
- Renders: date pill, streak pill (hardcode 0 for now), greeting, prompt text, input card with photo icons, submit button
- Fetch today's prompt via `assign_prompt_for_today()` RPC (see SCHEMA.md)
- Show a loading state until prompt arrives
- Test: today's prompt appears, palette matches the current day

## Step 5 — Post composer

- `src/components/PostComposer.tsx` — wraps the input card and submit button
- Controlled textarea with 280 char limit, live counter, disabled submit when empty
- Photo button → opens file picker, shows preview thumbnail
- On submit: client-side resize photo if present, upload to `post-photos/{user_id}/{post_id}.jpg`, then insert into `posts` table
- Use the `submit_post` RPC if it's built, otherwise do the insert directly for M1 (we can refactor later)
- Show optimistic loading state, handle errors with a toast
- Test: submit text-only post, submit photo-only post, submit both, hit char limit

## Step 6 — Today completed state

- After successful post (or on page load if there's already a post for today), render a different layout:
  - Same palette background
  - "Done for today" pill
  - The user's posted text in a white card
  - The user's photo (signed URL via Supabase storage) below if present
  - "See you tomorrow" card at the bottom (with placeholder reminder time text for now)
- Posts within 5 minutes are editable; show an "Edit" affordance that returns to composer
- Test: submit a post, refresh, see the completed state. Edit within 5 mins, edit locks after.

## Step 7 — Streak calculation

- `src/lib/streak.ts` — pure function that takes the user's post history and returns `{ current, longest }`. Grace day logic NOT in M1 (defer to M2 — for M1, missing a day = streak resets)
- After submit, recompute and update the `profiles.current_streak` and `longest_streak`
- Render real streak in the streak pill
- Test: post on day N, post on day N+1, streak = 2. Skip a day, post again, streak = 1.

## Step 8 — History view

- `src/screens/History.tsx`
- Fetch all user's posts ordered by date desc
- Show stats grid at top: current streak, longest streak, total posts
- Show 6-week heatmap calendar (each cell colored using that day's palette accent if posted, neutral if not)
- Below that, list recent posts grouped by week: date, prompt, content
- Bottom nav routes between Today, History, Profile
- Test: view history, click around, posts display correctly

## Step 9 — Onboarding (3 screens)

- `src/screens/Onboarding.tsx` — Reduces to 3 screens before SignIn for new users.
  Screen 1: welcome + tagline (yellow — pre-week, can use a neutral celebratory color)
  Screen 2: how it works, 4 bullets
  Screen 3: reminder time picker (stored to localStorage only in M1 — actual notification setup is M2) + email input
- Skip onboarding if user has profile.created_at older than 1 minute
- Test: clear local storage, sign out, sign back in, see onboarding

## Step 10 — Profile screen + sign out

- `src/screens/Profile.tsx`
- Show display name, member-since date, streak stats
- Edit display name
- Reminder time (stored in localStorage for M1)
- Sign out button
- Test: change name, sign out, sign back in, name persists

## Step 11 — Deploy

This is mostly user-driven via the Vercel and Supabase web dashboards. Follow SETUP.md Steps 8–10:
- User pushes the repo to GitHub (you can write the git commands, user runs them)
- User connects Vercel to the repo via vercel.com
- User adds the env vars in the Vercel dashboard
- User updates Supabase Auth → URL Configuration to include the Vercel URL
- Test the magic-link flow on a real phone (not just devtools emulation)
- Install as PWA from mobile Chrome/Safari, verify it launches standalone

If the magic link redirects to localhost in production, the Site URL in Supabase Auth → URL Configuration is wrong.

## Acceptance criteria for M1 done

- [ ] A new user can sign up via magic link
- [ ] They see onboarding once
- [ ] They land on today's prompt, color matches the day of the week
- [ ] They can post text, photo, or both
- [ ] After posting, they see the completed state with their post
- [ ] They can edit their post within 5 minutes
- [ ] Posting builds a streak; missing a day resets it
- [ ] History view shows their post history with stats and heatmap
- [ ] All works on mobile Safari and Chrome
- [ ] PWA installs from mobile browser
- [ ] All text has 4.5:1 contrast minimum on its background
- [ ] Keyboard navigation works for all interactions
- [ ] Deployed to Vercel and accessible at a stable URL

## Out of scope for M1 (defer to M2+)

- Push notifications and reminders
- Grace day mechanic (M1 = miss a day, streak resets)
- Share permission toggles (M4)
- Admin dashboard (M3)
- Automated moderation (M4)
- Public share page (M5)
- Animated decorative shapes (defer until visuals feel right statically)
- Streak milestone celebrations (M2)

## When you hit a decision not specified here

- For UI ambiguity: refer to DESIGN.md, then to the structure shown in the mockups in the conversation that generated this spec
- For backend ambiguity: keep the simplest thing that satisfies the user-facing requirement, document the choice in a comment
- For library choice: don't add a new dependency without asking — STACK.md is the allowlist
