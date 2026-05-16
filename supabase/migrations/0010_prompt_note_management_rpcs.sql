-- M3 Step 2: Security-definer RPCs for admin prompt + note management.
-- Each function handles both the data change and the audit log insert.

-- ── Prompts ──────────────────────────────────────────────────────────────────

create or replace function admin_create_prompt(p_text text)
returns prompts
language plpgsql security definer as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean;
  v_row prompts;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  insert into prompts (text, created_by)
    values (p_text, v_actor)
    returning * into v_row;

  insert into admin_audit (target_prompt, action, actor)
    values (v_row.id, 'prompt_created', v_actor);

  return v_row;
end $$;

create or replace function admin_update_prompt(p_id uuid, p_text text)
returns void
language plpgsql security definer as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  update prompts set text = p_text where id = p_id;

  insert into admin_audit (target_prompt, action, actor)
    values (p_id, 'prompt_edited', v_actor);
end $$;

create or replace function admin_set_prompt_active(p_id uuid, p_active boolean)
returns void
language plpgsql security definer as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean;
  v_action text;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  update prompts set active = p_active where id = p_id;

  v_action := case when p_active then 'prompt_reactivated' else 'prompt_deactivated' end;
  insert into admin_audit (target_prompt, action, actor)
    values (p_id, v_action, v_actor);
end $$;

-- ── Notes ─────────────────────────────────────────────────────────────────────

create or replace function admin_create_note(
  p_text       text,
  p_pool       text,
  p_day_of_week int default null
)
returns notes
language plpgsql security definer as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean;
  v_row notes;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  insert into notes (text, pool, day_of_week, created_by)
    values (p_text, p_pool, p_day_of_week, v_actor)
    returning * into v_row;

  insert into admin_audit (target_note, action, actor)
    values (v_row.id, 'note_created', v_actor);

  return v_row;
end $$;

create or replace function admin_update_note(
  p_id          uuid,
  p_text        text,
  p_day_of_week int default null
)
returns void
language plpgsql security definer as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  update notes set text = p_text, day_of_week = p_day_of_week where id = p_id;

  insert into admin_audit (target_note, action, actor)
    values (p_id, 'note_edited', v_actor);
end $$;

create or replace function admin_set_note_active(p_id uuid, p_active boolean)
returns void
language plpgsql security definer as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean;
  v_action text;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  update notes set active = p_active where id = p_id;

  v_action := case when p_active then 'note_reactivated' else 'note_deactivated' end;
  insert into admin_audit (target_note, action, actor)
    values (p_id, v_action, v_actor);
end $$;
