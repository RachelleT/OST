# One-Time Setup Checklist

Everything you need to do once, by hand, before Claude Code can start building. Most steps are web-only; a couple are local terminal commands.

## What's already done

- [x] GitHub repo created (empty, no commits yet)
- [x] Supabase project created
- [x] Supabase project linked to GitHub repo

## Prerequisites on your local machine

Before opening Claude Code, verify:

- **Node.js 24 LTS** installed (or v22 LTS — both are supported). Check with `node -v` in a terminal. If not installed, get it from [nodejs.org](https://nodejs.org) — pick the version labeled "LTS." For multi-Node-version flexibility, install **nvm** (Mac/Linux: [nvm](https://github.com/nvm-sh/nvm)) or **fnm** (Windows: [fnm](https://github.com/Schniz/fnm)) instead — these let you switch versions per project automatically.
- **npm** comes with Node, no separate install. Check with `npm -v` — should be 10.x or higher.
- **git** installed and configured. Check with `git --version`.

Node packages will install into a `node_modules/` folder inside the project — they don't go on your system globally, and they don't conflict with other projects. There's no "virtual environment" step needed; Node is project-isolated by default.

## Step 1 — Grab Supabase credentials

In the Supabase dashboard:

1. Click the gear icon (Project Settings) at the bottom left
2. Open the **API** section
3. Copy these two values somewhere safe (you'll paste them into `.env.local` once Claude Code scaffolds the project):
   - **Project URL** → will become `VITE_SUPABASE_URL`
   - **Project API Keys → `anon` `public`** → will become `VITE_SUPABASE_ANON_KEY`

Also copy the **`service_role` `secret`** key into your password manager — but **DO NOT** give it to Claude Code, do not put it in any file in the repo, and do not paste it into chat. You won't need it for Milestone 1; it's just for safekeeping.

## Step 2 — Configure Supabase auth

In the Supabase dashboard:

1. **Authentication → Providers**
2. Confirm **Email** is enabled
3. Open the Email provider settings
4. **Turn OFF "Confirm email"** — the magic link itself is the verification step. Leaving this on causes a confusing double-email flow.
5. Save

While you're in Authentication:

6. Go to **Authentication → URL Configuration**
7. Set **Site URL** to your eventual production URL (e.g. `https://onesmallthing.vercel.app` — you'll know the exact URL after Step 6 below). For now, set it to `http://localhost:5173` so local development works.
8. Add **Additional Redirect URLs**: both `http://localhost:5173/**` and (later) your Vercel URL with `/**`

You can come back and add the Vercel URL once you have it.

## Step 3 — Run the initial database migration

Claude Code will create a file at `supabase/migrations/0001_initial_schema.sql` based on SCHEMA.md. When it does:

1. Open the file Claude Code created
2. Copy the entire contents
3. In Supabase dashboard, open **SQL Editor** (left sidebar)
4. Click **New query**
5. Paste the SQL
6. Click **Run** (bottom right)
7. Verify success — you should see "Success. No rows returned" or similar

If there's an error, paste the error message back to Claude Code and let it fix the SQL.

After the migration runs, in the dashboard go to **Table Editor** and confirm you see all the expected tables: `profiles`, `prompts`, `daily_assignments`, `posts`, `grace_days_used`, `moderation_queue`, `featured_posts`, `push_subscriptions`.

## Step 4 — Seed the starter prompts

Same process as Step 3, but for the seed file:

1. Claude Code creates `supabase/seed.sql`
2. Copy contents → SQL Editor → New query → Run
3. Open Table Editor → `prompts` table → confirm 5 rows exist

## Step 5 — Create the storage bucket

In the Supabase dashboard:

1. Click **Storage** in the left sidebar
2. Click **New bucket**
3. Name: `post-photos`
4. **Public bucket: OFF** (keep it private — photos served via signed URLs)
5. **File size limit: 5 MB**
6. **Allowed MIME types**: `image/jpeg, image/png, image/webp`
7. Create

Then add the bucket policies. In Storage → click on `post-photos` → **Policies** tab → New policy → custom:

**Policy 1 — Users upload their own photos**
- Name: `users upload own photos`
- Operation: INSERT
- Target roles: `authenticated`
- USING expression: (leave blank)
- WITH CHECK expression:
  ```
  bucket_id = 'post-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  ```

**Policy 2 — Users read their own photos**
- Name: `users read own photos`
- Operation: SELECT
- Target roles: `authenticated`
- USING expression:
  ```
  bucket_id = 'post-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  ```

(Admin read-all policy can wait until M3.)

## Step 6 — Configure bootstrap admin emails

Admins are auto-promoted on first sign-in if their email is in the `BOOTSTRAP_ADMIN_EMAILS` config. No manual Table Editor step needed for you and your teammate.

This config lives in a single database row in a `config` table (created by the initial migration). To set it:

1. In Supabase dashboard, open **SQL Editor** → New query
2. Paste this, replacing the emails with yours and your teammate's:
   ```sql
   update config set value = 'you@example.com,teammate@example.com'
   where key = 'bootstrap_admin_emails';
   ```
3. Run

Now when either of you signs in for the first time, the auth trigger will see your email in the list and set `is_admin = true` automatically.

The list is "always on": if someone in this list ever gets demoted (by themselves or another admin), they'll be re-promoted on their next sign-in. This is your escape hatch — you can never permanently lock yourself out of admin access while your email is in this list.

To later **revoke** bootstrap admin access for someone, edit the list with another SQL update statement.

To **add a new admin who isn't in the bootstrap list**, use the in-app admin invite flow (built in M3). See PRODUCT.md for the mechanic.

## Step 7 — Local development setup

Once Claude Code has scaffolded the project locally:

1. Verify `.env.local` exists in the project root with:
   ```
   VITE_SUPABASE_URL=<your project URL from Step 1>
   VITE_SUPABASE_ANON_KEY=<your anon key from Step 1>
   ```
2. Verify `.env.local` is in `.gitignore` (Vite default — but double-check)
3. Run `npm install`
4. Run `npm run dev`
5. Open `http://localhost:5173` — you should see the app

## Step 8 — First commit and push to GitHub

Once Milestone 1 is partially working locally:

1. In your terminal, in the project directory:
   ```
   git init
   git add .
   git commit -m "initial scaffold"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. Refresh your GitHub repo page and confirm the files are there
3. Confirm `.env.local` is NOT in the repo (if it is, you need to fix `.gitignore` and remove it from git history before continuing)

You can let Claude Code run these git commands for you if you trust it with your shell, or run them yourself.

## Step 9 — Connect Vercel

1. Go to vercel.com and sign in with GitHub
2. **Add New → Project**
3. Import the GitHub repo
4. Framework Preset: **Vite** (should auto-detect)
5. **Environment Variables**: add both
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Click **Deploy**
7. Once deployed, copy the production URL
8. Go back to **Step 2** in this checklist and add that URL to Supabase Auth → URL Configuration:
   - Site URL (replace localhost)
   - Additional Redirect URLs (add `https://<your-url>/**`)

## Step 10 — Verify end-to-end

1. Open your Vercel production URL on a phone
2. Sign in with your email
3. Check email, click the magic link
4. Verify it returns to the production URL signed in
5. Post your first response to today's prompt
6. Verify it appears in the Supabase Table Editor under `posts`

If anything fails at this step, the magic link is almost certainly pointing at the wrong URL — recheck the Supabase Auth → URL Configuration values.

## Quick reference

| Thing | Where it lives |
|-------|----------------|
| Database schema | `supabase/migrations/*.sql` (in repo) → run via SQL Editor |
| Seed data | `supabase/seed.sql` (in repo) → run via SQL Editor |
| Anon key, project URL | `.env.local` locally, Vercel env vars in production |
| Service role key | Password manager only — never in repo |
| Admin promotion | Bootstrap emails via `config` table; in-app invites from M3 |
| Storage policies | Set via dashboard, mirrored in SCHEMA.md for reference |

## What Claude Code is allowed to do

- Write SQL files into `supabase/migrations/` and `supabase/seed.sql`
- Write application code, configs, env example files
- Run `npm install`, `npm run dev`, `npm run build`
- Run `git` commands (commit, push) **if you've confirmed it's safe to do so on your machine**

## What Claude Code should NOT do

- Install or use the Supabase CLI
- Try to connect to the database directly (no `psql`, no connection strings)
- Touch `.env.local` after you've added real credentials
- Run anything that needs the service role key
- Push to git without you confirming first (especially the first push)
