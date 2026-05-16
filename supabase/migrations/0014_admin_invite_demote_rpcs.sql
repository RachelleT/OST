-- M3 Step 5: invite_admin, demote_admin, get_admin_list, get_audit_log RPCs

-- ── invite_admin ──────────────────────────────────────────────────────────────
-- Returns 'promoted' if the email already has an account (immediate promotion),
-- or 'invited' if no account exists yet (pending invite row created).

create or replace function invite_admin(p_email text)
returns text
language plpgsql security definer as $$
declare
  v_actor      uuid := auth.uid();
  v_is_admin   boolean;
  v_target_id  uuid;
  v_clean_email text := lower(trim(p_email));
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  -- Check if this email already has a Supabase Auth account
  select id into v_target_id from auth.users where email = v_clean_email;

  if v_target_id is not null then
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
    -- Create a pending invite; the sign-in trigger will promote them
    insert into admin_invites (email, invited_by)
      values (v_clean_email, v_actor)
      on conflict (email) do update
        set invited_by = v_actor, invited_at = now(), consumed_at = null, consumed_by = null;

    insert into admin_audit (target_user, action, actor)
      values (null, 'invited', v_actor);

    return 'invited';
  end if;
end $$;

-- ── demote_admin ──────────────────────────────────────────────────────────────

create or replace function demote_admin(p_target_id uuid)
returns void
language plpgsql security definer as $$
declare
  v_actor           uuid := auth.uid();
  v_is_admin        boolean;
  v_admin_count     int;
  v_bootstrap_emails text;
  v_target_email    text;
  v_is_bootstrap    boolean := false;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  if p_target_id = v_actor then
    raise exception 'you cannot demote yourself';
  end if;

  -- Last-admin guard
  select count(*) into v_admin_count from profiles where is_admin = true;
  if v_admin_count <= 1 then
    raise exception 'cannot remove the last admin';
  end if;

  -- Bootstrap guard
  select value into v_bootstrap_emails from config where key = 'bootstrap_admin_emails';
  select email into v_target_email from auth.users where id = p_target_id;

  if v_bootstrap_emails is not null and length(v_bootstrap_emails) > 0 and v_target_email is not null then
    v_is_bootstrap := exists (
      select 1 from unnest(string_to_array(v_bootstrap_emails, ',')) as e
      where trim(e) = v_target_email
    );
  end if;

  if v_is_bootstrap then
    raise exception 'cannot demote a bootstrap admin — remove their email from the bootstrap config list first';
  end if;

  update profiles set is_admin = false where id = p_target_id;

  insert into admin_audit (target_user, action, actor)
    values (p_target_id, 'demoted', v_actor);
end $$;

-- ── get_admin_list ────────────────────────────────────────────────────────────
-- Returns current admins with email (from auth.users) and bootstrap status.

create or replace function get_admin_list()
returns table(
  id           uuid,
  display_name text,
  email        text,
  is_bootstrap boolean,
  promoted_at  timestamptz
)
language plpgsql security definer as $$
declare
  v_actor           uuid := auth.uid();
  v_is_admin        boolean;
  v_bootstrap_emails text;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  select value into v_bootstrap_emails from config where key = 'bootstrap_admin_emails';

  return query
    select
      p.id,
      p.display_name,
      au.email::text,
      case
        when v_bootstrap_emails is not null and length(v_bootstrap_emails) > 0
        then exists (
          select 1 from unnest(string_to_array(v_bootstrap_emails, ',')) as e
          where trim(e) = au.email
        )
        else false
      end as is_bootstrap,
      (
        select aa.created_at
        from admin_audit aa
        where aa.target_user = p.id
          and aa.action in ('promoted', 'bootstrap_auto')
        order by aa.created_at desc
        limit 1
      ) as promoted_at
    from profiles p
    join auth.users au on au.id = p.id
    where p.is_admin = true
    order by promoted_at asc nulls last;
end $$;

-- ── get_audit_log ─────────────────────────────────────────────────────────────

create or replace function get_audit_log(p_limit int default 50)
returns table(
  id          uuid,
  action      text,
  actor_name  text,
  target_name text,
  reason      text,
  created_at  timestamptz
)
language plpgsql security definer as $$
declare
  v_actor    uuid := auth.uid();
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  return query
    select
      aa.id,
      aa.action,
      actor_p.display_name  as actor_name,
      target_p.display_name as target_name,
      aa.reason,
      aa.created_at
    from admin_audit aa
    left join profiles actor_p  on actor_p.id  = aa.actor
    left join profiles target_p on target_p.id = aa.target_user
    order by aa.created_at desc
    limit p_limit;
end $$;

grant execute on function invite_admin(text)    to authenticated;
grant execute on function demote_admin(uuid)    to authenticated;
grant execute on function get_admin_list()      to authenticated;
grant execute on function get_audit_log(int)    to authenticated;
