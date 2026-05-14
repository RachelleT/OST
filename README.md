# One Small Thing — Build Spec

Working title. A daily-prompt journaling PWA. One prompt per user per day, 280 characters or a photo, private by default, builds a streak.

## How to use these specs

Read in this order:
1. **README.md** (this file) — project overview, build approach, milestones
2. **SETUP.md** — the one-time setup the user does in web dashboards (Supabase, GitHub, Vercel)
3. **PRODUCT.md** — product mechanics in detail (streaks, prompts, sharing, moderation)
4. **DESIGN.md** — visual system (colors, typography, components)
5. **SCHEMA.md** — database schema and row-level security
6. **STACK.md** — tech choices and setup steps
7. **MILESTONE_1.md** — what to build first, in order

Do not skip ahead to later milestones. Ship Milestone 1 end-to-end before starting Milestone 2.

## Build philosophy

- **Ship the core loop first.** Auth → daily prompt → post → see it back. Everything else is layered on after that works.
- **Hardcode before you generalize.** First version of the prompt pool is a TypeScript array. Move to database in Milestone 3.
- **Free tier only.** No paid services until there's real traction. Supabase free tier, Vercel free tier, Web Push (not OneSignal), email auth only (no SMS).
- **PWA, not native.** Deploy as a web app users can install. No app stores in v1.
- **Mobile-first, then responsive up.** Design at 375px wide, scale up gracefully. Most users will be on phones.

## Tech stack

- **Frontend**: React 18 + Vite + TypeScript, deployed as a PWA
- **Styling**: Tailwind CSS + custom design tokens (see DESIGN.md)
- **Animation**: Framer Motion (lazy-loaded; only where it matters)
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **Hosting**: Vercel (frontend), Supabase (everything else)
- **Notifications**: Web Push API directly, VAPID keys, custom service worker
- **Moderation**: OpenAI Moderation endpoint (text), Google Cloud Vision SafeSearch (images), deferred to Milestone 4

See STACK.md for setup steps and version pinning.

## Milestones

**M1 — Core loop** (build this first, ship to ~5 friends)
Auth via magic link, today screen with prompt, post composer with 280-char text + photo upload, history view, streak calculation. Prompt pool hardcoded.

**M2 — Reminders + grace day**
Web push setup, user reminder time preference, skip-if-already-posted logic, grace day mechanic.

**M3 — Admin**
Admin role, prompt CRUD UI, all-posts dashboard, share permission filtering, share-card image generation.

**M4 — Moderation**
Automated moderation on post submit, admin review queue, the share permission toggles in the composer.

**M5 — Public share page**
`/p/[id]` route for featured posts, social meta tags, anonymous vs named display logic.

## What "done" means for each milestone

- All happy paths work on mobile (test in Chrome DevTools mobile emulation minimum)
- No console errors
- Accessibility: keyboard navigable, screen reader labels, 4.5:1 contrast minimum
- Deployed to Vercel, accessible at a real URL

## Out of scope for v1

Do not build any of these without explicit go-ahead:
- Social features (followers, likes, comments, public feeds)
- iOS/Android native apps
- Phone/SMS auth
- AI-generated prompts
- Multi-language support
- Account deletion UI (manual via Supabase dashboard is fine for v1)
- Email digests or weekly recaps
- Export-to-PDF
