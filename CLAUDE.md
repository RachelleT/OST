# Instructions for Claude Code

This is a build spec for "One Small Thing," a daily-prompt journaling PWA. You are picking up a project that has been designed but not yet built.

## Read these files in order before writing any code

1. `README.md` — overview, milestones, what's out of scope
2. `SETUP.md` — the one-time setup the user does in web dashboards (Supabase, GitHub, Vercel). Read this so you know which parts are user-driven and which are yours.
3. `PRODUCT.md` — full product mechanics
4. `DESIGN.md` — visual system (especially the weekly color rotation)
5. `SCHEMA.md` — database schema and RLS policies
6. `STACK.md` — tech choices, pinned versions, project structure
7. `MILESTONE_1.md` — step-by-step for the first milestone (core loop) — COMPLETE
8. `MILESTONE_2.md` — step-by-step for the second milestone (reminders + grace day) — COMPLETE
9. `MILESTONE_2.1.md` — small follow-on to M2 (warm notes on Today screen)
10. `MILESTONE_3.md` — step-by-step for the third milestone (admin)
11. `MILESTONE_4.md` — step-by-step for the fourth milestone (moderation, launch gate)

M1, M2, M2.1, and M3 are all complete. M3 is locked — no changes to existing M3 code; if M4 needs touchups to M3 surfaces, those are framed as M4 enhancements (see MILESTONE_4.md "Important: M3 already shipped without M4 in mind"). M4 is the **launch gate** — after M4 ships and a 5–7 day validation period passes, the app is safe to open to a wider audience. Until then, keep the user base to friends. Read the milestone file the user points you at; do not jump ahead.

## Environment

This project is set up to use the **Supabase web dashboard only** — no Supabase CLI, no direct database connections. When schema or seed changes are needed, you write SQL files into `supabase/migrations/` or `supabase/seed.sql` and **ask the user to paste them into the dashboard SQL Editor**. Do not try to run them yourself.

Similarly: do not write real Supabase credentials anywhere. The user pastes them into `.env.local` themselves. You only ever create `.env.example` with placeholder values.

For git: the repo is empty (no commits yet). You can write `git` commands but the user runs the first `git push` themselves (see SETUP.md Step 8). After that initial push, follow whatever the user prefers — running commands or just writing files.

## How to work on this project

- **One milestone at a time.** Do not start M2 work while building M1. Specifically: no push notifications, no admin dashboard, no moderation, no grace days in M1.
- **One step at a time within a milestone.** After each step, verify it works (run dev server, click through the flow) before moving on.
- **Confirm before adding dependencies.** STACK.md lists the allowed packages. If you think you need something else, ask first.
- **Match the design.** DESIGN.md and the mockups are the source of truth. If something looks wrong, fix it before moving on rather than "we can polish later" — polish doesn't get done later.
- **Use the day's palette via CSS variables**, not hardcoded hex values in components. The palette helper is the single source.
- **Don't write your own auth, your own moderation, or your own image upload.** Use Supabase Auth, defer moderation to M4, use Supabase Storage.

## Decisions already made — do not relitigate

- PWA, not native app. Not Capacitor. Just a web app users can install.
- Email magic link auth only in v1. No phone, no SMS, no OAuth.
- 280 character text limit.
- One post per user per day. Editable for 5 minutes after.
- Posts are private by default. Two opt-in share toggles (anonymous, with-name).
- Streak resets if user misses a day with no grace available. M1 has no grace day — that comes in M2.
- 7 colors, one per weekday. Fixed assignment. See DESIGN.md.
- TypeScript everywhere.
- React + Vite. Not Next.js.
- Tailwind for styling. No UI kits.
- Free tier of everything (Supabase, Vercel, Web Push directly via VAPID).
- Supabase managed via web dashboard only. No Supabase CLI. SQL changes go via files in `supabase/migrations/`, run by the user via the dashboard SQL Editor.

## Quality bar

- Every screen must work on a 375px-wide mobile viewport
- 4.5:1 contrast minimum (verify the accent colors against the day backgrounds)
- Keyboard navigable, with visible focus indicators
- Honors `prefers-reduced-motion`
- No console errors or warnings
- TypeScript strict mode on, no `any` types except where unavoidable (and commented)
- All async operations have loading states and error handling

## When in doubt

- The mockups generated during design (which the user can show you) are the visual source of truth
- The smallest thing that works is better than the cleverest thing that almost works
- Ask the user. Better to confirm than to invent.

## Hand-off

When M1 is complete:
1. Confirm the user has done SETUP.md Steps 8–10 (git push, Vercel connect, Vercel deploy)
2. Share the production URL with the user
3. List anything you couldn't implement as specified, with reasons
4. Don't start M2 until the user has tested M1 with real users and given the go-ahead
