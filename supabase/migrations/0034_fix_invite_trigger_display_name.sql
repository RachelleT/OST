-- Fix handle_user_confirmed (and handle_new_user for safety) to treat an
-- empty display_name in raw_user_meta_data as null before falling back to
-- 'Friend'. inviteUserByEmail sets display_name to "" which coalesce passes
-- through, violating the profiles length check and causing a database error
-- when the invited user clicks their link.

create or replace function handle_user_confirmed()
returns trigger language plpgsql security definer as $$
declare
  v_email text := lower(trim(new.email));
  v_bootstrap_emails text;
  v_is_bootstrap boolean := false;
  v_has_invite boolean := false;
  v_should_admin boolean := false;
  v_display_name text;
begin
  -- Only act when email_confirmed_at transitions null → non-null
  if old.email_confirmed_at is not null or new.email_confirmed_at is null then
    return new;
  end if;

  -- Profile may already exist (edge case); skip if so
  if exists (select 1 from profiles where id = new.id) then
    return new;
  end if;

  select value into v_bootstrap_emails from config where key = 'bootstrap_admin_emails';
  if v_bootstrap_emails is not null and length(v_bootstrap_emails) > 0 then
    v_is_bootstrap := exists (
      select 1 from unnest(string_to_array(v_bootstrap_emails, ',')) as e
      where lower(trim(e)) = v_email
    );
  end if;

  v_has_invite := exists (
    select 1 from admin_invites
    where lower(trim(email)) = v_email and consumed_at is null
  );

  v_should_admin := v_is_bootstrap or v_has_invite;

  -- Use nullif so that an empty string falls back to 'Friend'
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    'Friend'
  );

  insert into profiles (id, display_name, timezone, is_admin)
    values (new.id, v_display_name, 'UTC', v_should_admin)
    on conflict (id) do nothing;

  if v_has_invite then
    update admin_invites
    set consumed_at = now(), consumed_by = new.id
    where lower(trim(email)) = v_email and consumed_at is null;

    insert into admin_audit (target_user, action, reason)
      values (new.id, 'invited', 'invite consumed on email confirmation');
  end if;

  if v_is_bootstrap then
    insert into admin_audit (target_user, action, reason)
      values (new.id, 'bootstrap_auto', 'email in bootstrap_admin_emails config');
  end if;

  return new;
end $$;

-- Apply the same defensive fix to handle_new_user
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_email text := lower(trim(new.email));
  v_bootstrap_emails text;
  v_is_bootstrap boolean := false;
  v_has_invite boolean := false;
  v_should_admin boolean := false;
  v_display_name text;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  select value into v_bootstrap_emails from config where key = 'bootstrap_admin_emails';
  if v_bootstrap_emails is not null and length(v_bootstrap_emails) > 0 then
    v_is_bootstrap := exists (
      select 1 from unnest(string_to_array(v_bootstrap_emails, ',')) as e
      where lower(trim(e)) = v_email
    );
  end if;

  v_has_invite := exists (
    select 1 from admin_invites
    where lower(trim(email)) = v_email and consumed_at is null
  );

  v_should_admin := v_is_bootstrap or v_has_invite;

  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    'Friend'
  );

  insert into profiles (id, display_name, timezone, is_admin)
    values (new.id, v_display_name, 'UTC', v_should_admin)
    on conflict (id) do nothing;

  if v_has_invite then
    update admin_invites
    set consumed_at = now(), consumed_by = new.id
    where lower(trim(email)) = v_email and consumed_at is null;

    insert into admin_audit (target_user, action, reason)
      values (new.id, 'invited', 'invite consumed on sign-in');
  end if;

  if v_is_bootstrap then
    insert into admin_audit (target_user, action, reason)
      values (new.id, 'bootstrap_auto', 'email in bootstrap_admin_emails config');
  end if;

  return new;
end $$;
