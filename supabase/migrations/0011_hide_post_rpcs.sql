-- M3 Step 3: hide_post and unhide_post security-definer RPCs

create or replace function hide_post(post_id uuid, hide_reason text default null)
returns void
language plpgsql security definer as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  update posts set moderation_status = 'hidden' where id = post_id;

  insert into admin_audit (target_post, action, actor, reason)
    values (post_id, 'post_hidden', v_actor, hide_reason);
end $$;

create or replace function unhide_post(post_id uuid)
returns void
language plpgsql security definer as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = v_actor;
  if not v_is_admin then raise exception 'not authorized'; end if;

  update posts set moderation_status = 'approved' where id = post_id;

  insert into admin_audit (target_post, action, actor)
    values (post_id, 'post_unhidden', v_actor);
end $$;
