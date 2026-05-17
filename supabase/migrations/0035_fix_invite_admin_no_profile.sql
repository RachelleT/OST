-- Harden invite_admin to handle the case where auth.users exists but
-- profiles does not (e.g. a previous invite attempt where the trigger failed).
-- Previously this path tried to immediately promote and insert an audit row,
-- hitting a FK violation because no profile row existed.
-- Now we treat "auth account exists but no profile" the same as "no account" —
-- create a pending invite so the trigger can create the profile on confirmation.

create or replace function invite_admin(p_email text)
returns text
language plpgsql security definer as $$
declare
  v_actor       uuid := auth.uid();
  v_is_admin    boolean;
  v_target_id   uuid;
  v_has_profile boolean := false;
  v_clean_email text := lower(trim(p_email));
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  -- Check if this email has an auth account
  select id into v_target_id from auth.users where email = v_clean_email;

  -- Only do an immediate promotion if they have BOTH an auth account AND a profile
  if v_target_id is not null then
    select exists(select 1 from profiles where id = v_target_id) into v_has_profile;
  end if;

  if v_target_id is not null and v_has_profile then
    -- Promote immediately
    update profiles set is_admin = true where id = v_target_id;

    insert into admin_invites (email, invited_by, consumed_at, consumed_by)
      values (v_clean_email, v_actor, now(), v_target_id)
      on conflict (email) do update
        set consumed_at = now(), consumed_by = v_target_id, invited_by = v_actor;

    insert into admin_audit (target_user, action, actor)
      values (v_target_id, 'promoted', v_actor);

    return 'promoted';
  else
    -- No account yet (or account exists but no profile — treat as pending)
    insert into admin_invites (email, invited_by)
      values (v_clean_email, v_actor)
      on conflict (email) do update
        set invited_by = v_actor, invited_at = now(), consumed_at = null, consumed_by = null;

    insert into admin_audit (target_user, action, actor)
      values (null, 'invited', v_actor);

    return 'invited';
  end if;
end $$;

grant execute on function invite_admin(text) to authenticated;
