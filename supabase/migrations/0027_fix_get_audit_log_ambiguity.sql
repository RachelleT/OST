-- Fix "column reference is ambiguous" in get_audit_log.
-- Same PL/pgSQL RETURNS TABLE variable-scope issue as get_admin_list.
-- Rewriting in LANGUAGE SQL resolves it.

create or replace function get_audit_log(p_limit int default 50)
returns table(
  id          uuid,
  action      text,
  actor_name  text,
  target_name text,
  reason      text,
  created_at  timestamptz
)
language sql security definer
stable
as $$
  select
    aa.id,
    aa.action,
    actor_p.display_name  as actor_name,
    target_p.display_name as target_name,
    aa.reason,
    aa.created_at
  from admin_audit aa
  left join profiles actor_p  on actor_p.id = aa.actor
  left join profiles target_p on target_p.id = aa.target_user
  order by aa.created_at desc
  limit p_limit;
$$;

grant execute on function get_audit_log(int) to authenticated;
