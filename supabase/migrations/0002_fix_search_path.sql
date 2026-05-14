-- Fix: add explicit search_path to all security definer functions
-- Required in newer Supabase/Postgres versions where the default search path
-- is restricted and functions can't locate public schema tables without this.

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(new.email));
  v_bootstrap_emails text;
  v_is_bootstrap boolean := false;
  v_has_invite boolean := false;
  v_should_admin boolean := false;
begin
  select value into v_bootstrap_emails from config where key = 'bootstrap_admin_emails';
  if v_bootstrap_emails is not null and length(v_bootstrap_emails) > 0 then
    v_is_bootstrap := exists (
      select 1 from unnest(string_to_array(v_bootstrap_emails, ',')) as email
      where lower(trim(email)) = v_email
    );
  end if;

  v_has_invite := exists (
    select 1 from admin_invites
    where lower(trim(admin_invites.email)) = v_email and consumed_at is null
  );

  v_should_admin := v_is_bootstrap or v_has_invite;

  insert into profiles (id, display_name, timezone, is_admin)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'display_name', 'Friend'),
      'UTC',
      v_should_admin
    );

  if v_has_invite then
    update admin_invites
    set consumed_at = now(), consumed_by = new.id
    where lower(trim(admin_invites.email)) = v_email and consumed_at is null;

    insert into admin_audit (target_user, action, reason)
      values (new.id, 'invited', 'invite consumed on first sign-in');
  end if;

  if v_is_bootstrap then
    insert into admin_audit (target_user, action, reason)
      values (new.id, 'bootstrap_auto', 'email in bootstrap_admin_emails config');
  end if;

  return new;
end $$;

create or replace function ensure_bootstrap_admin()
returns void language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_bootstrap_emails text;
  v_is_bootstrap boolean := false;
  v_currently_admin boolean;
begin
  if v_user_id is null then return; end if;

  select lower(trim(auth.users.email)) into v_email from auth.users where id = v_user_id;
  select value into v_bootstrap_emails from config where key = 'bootstrap_admin_emails';

  if v_bootstrap_emails is null or length(v_bootstrap_emails) = 0 then return; end if;

  v_is_bootstrap := exists (
    select 1 from unnest(string_to_array(v_bootstrap_emails, ',')) as email
    where lower(trim(email)) = v_email
  );

  if not v_is_bootstrap then return; end if;

  select is_admin into v_currently_admin from profiles where id = v_user_id;

  if not v_currently_admin then
    update profiles set is_admin = true where id = v_user_id;
    insert into admin_audit (target_user, action, reason)
      values (v_user_id, 'promoted', 'bootstrap admin restored on sign-in');
  end if;
end $$;

create or replace function assign_prompt_for_today()
returns daily_assignments language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_existing daily_assignments;
  v_prompt_id uuid;
begin
  select * into v_existing from daily_assignments
    where user_id = v_user_id and date = v_today;
  if found then return v_existing; end if;

  select id into v_prompt_id from prompts
    where active = true
      and id not in (
        select prompt_id from daily_assignments
          where user_id = v_user_id and date > v_today - interval '30 days'
      )
    order by md5(v_user_id::text || v_today::text || id::text)
    limit 1;

  if v_prompt_id is null then
    select id into v_prompt_id from prompts where active = true
      order by md5(v_user_id::text || v_today::text || id::text) limit 1;
  end if;

  insert into daily_assignments (user_id, date, prompt_id)
    values (v_user_id, v_today, v_prompt_id)
    returning * into v_existing;
  return v_existing;
end $$;
