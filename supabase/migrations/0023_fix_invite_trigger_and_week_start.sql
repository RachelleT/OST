-- Fix 1: handle_new_user should skip invite consumption when email is not yet
-- confirmed. inviteUserByEmail() creates the auth user immediately with
-- email_confirmed_at = null; the old trigger was consuming the invite record
-- before the person even clicked the link, so pending invites disappeared.
--
-- Magic link sign-ups insert with email_confirmed_at = now() (already confirmed),
-- so those still work correctly through the INSERT trigger.
-- Invited users (email_confirmed_at = null on INSERT) are handled by the new
-- UPDATE trigger below, which fires when they click the invite link.

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_email text := lower(trim(new.email));
  v_bootstrap_emails text;
  v_is_bootstrap boolean := false;
  v_has_invite boolean := false;
  v_should_admin boolean := false;
begin
  -- Skip profile creation for unconfirmed users (inviteUserByEmail flow).
  -- handle_user_confirmed() will create the profile when they click the link.
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

  insert into profiles (id, display_name, timezone, is_admin)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'display_name', 'Friend'),
      'UTC',
      v_should_admin
    )
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

-- Fix 2: UPDATE trigger — fires when the invited user clicks the link and
-- their email_confirmed_at changes from null to a timestamp.
create or replace function handle_user_confirmed()
returns trigger language plpgsql security definer as $$
declare
  v_email text := lower(trim(new.email));
  v_bootstrap_emails text;
  v_is_bootstrap boolean := false;
  v_has_invite boolean := false;
  v_should_admin boolean := false;
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

  insert into profiles (id, display_name, timezone, is_admin)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'display_name', 'Friend'),
      'UTC',
      v_should_admin
    )
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

create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function handle_user_confirmed();
