# Dayspark by Yuvoice — Build Spec

A daily-prompt journaling PWA. One prompt per user per day, 280 characters or a photo, private by default, builds a streak. Public Feed for posts users choose to share.

**Renamed in M5**: the project was originally called "One Small Thing" (OST) through M1-M4. M5 rebranded it to "Dayspark by Yuvoice." References to the old name in older milestone files are historical; new work uses Dayspark.

**Domain**: production lives at `https://dayspark.yuvoice.com` (a subdomain of the existing Yuvoice domain). The Vercel-default URL is the fallback. Setup is in M5 Step 1.

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

**M1 — Core loop** ✅ COMPLETE
Auth via magic link, today screen with prompt, post composer with 280-char text + photo upload, history view, streak calculation. Prompt pool hardcoded.

**M2 — Reminders + grace day** ✅ COMPLETE
Timezone-correct date handling, grace day mechanic, web push subscription + sending via pg_cron + Edge Function, gentle reminder copy with back-off, settings screen, streak milestones.

**M2.1 — Warm notes** ✅ COMPLETE
A soft note (encouragement, observation, light humor) shown on the Today screen — one before posting, one after.

**M3 — Admin** ✅ COMPLETE
Admin route gated by `is_admin`, prompt CRUD UI, all-posts dashboard with manual moderation/hide, featured posts + public `/p/{id}` route, share-card PNG generation, admin invite flow.

**M4 — Moderation** ✅ COMPLETE
Keyword-based text moderation (not OpenAI — see MILESTONE_4.md as-built notes), admin review queue, simplified sharing model, wellbeing awareness, rate limits, admin UI polish for eligibility. Validation period passed.

**M5 — Rename, Feed, and Public Surfaces** ← IN PROGRESS
The biggest milestone since M1. Three major changes:
- **Rename to Dayspark by Yuvoice** (replacing "One Small Thing" / OST throughout)
- **Feed**: a fourth nav tab showing posts users have chosen to share, with ✨ reactions
- **Simplified sharing model**: single per-post `is_public` toggle + global `show_name_on_shared` setting (replaces the old two-toggle model)
- **Public surfaces**: polished `/p/{id}` page, og:image generation, homepage, SEO basics, cache invalidation

See MILESTONE_5.md.

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
