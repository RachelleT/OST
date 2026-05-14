-- Fix: infinite recursion in RLS policies on profiles.
--
-- Root cause: policies like "admins read all profiles" do
--   exists (select 1 from profiles where id = auth.uid() and is_admin = true)
-- which queries profiles from within a profiles policy → infinite recursion.
--
-- Fix: replace every admin-check subquery with a security-definer function
-- that reads profiles outside of RLS, breaking the cycle.

-- 1. Create the helper (security definer bypasses RLS when it queries profiles)
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from profiles where id = auth.uid()),
    false
  )
$$;

-- 2. Drop and recreate every policy that referenced the recursive subquery

-- profiles
drop policy if exists "admins read all profiles" on profiles;
create policy "admins read all profiles" on profiles
  for select using (is_admin());

drop policy if exists "users update own profile" on profiles;
create policy "users update own profile" on profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = (select p.is_admin from profiles p where p.id = auth.uid())
  );

-- prompts
drop policy if exists "anyone reads active prompts" on prompts;
create policy "anyone reads active prompts" on prompts
  for select using (active = true or is_admin());

drop policy if exists "admins write prompts" on prompts;
create policy "admins write prompts" on prompts
  for all using (is_admin());

-- posts
drop policy if exists "admins read all posts" on posts;
create policy "admins read all posts" on posts
  for select using (is_admin());

-- moderation_queue
drop policy if exists "admins manage moderation queue" on moderation_queue;
create policy "admins manage moderation queue" on moderation_queue
  for all using (is_admin());

-- featured_posts
drop policy if exists "admins manage featured posts" on featured_posts;
create policy "admins manage featured posts" on featured_posts
  for all using (is_admin());

-- config
drop policy if exists "admins write config" on config;
create policy "admins write config" on config
  for all using (is_admin());

-- admin_invites
drop policy if exists "admins manage invites" on admin_invites;
create policy "admins manage invites" on admin_invites
  for all using (is_admin());

-- admin_audit
drop policy if exists "admins read audit" on admin_audit;
create policy "admins read audit" on admin_audit
  for select using (is_admin());
