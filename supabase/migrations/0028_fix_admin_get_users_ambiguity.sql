-- Fix "column reference is ambiguous" in admin_get_users.
-- Same PL/pgSQL RETURNS TABLE variable-scope issue as get_admin_list/get_audit_log.
-- Rewriting in LANGUAGE SQL. Auth check moves to a WHERE subquery (returns 0 rows
-- instead of an exception when called by a non-admin, which is fine since the
-- admin dashboard is already gated by RequireAdmin in the frontend).

create or replace function admin_get_users(
  p_search   text default null,
  p_filter   text default 'all',
  p_limit    int  default 50,
  p_offset   int  default 0
)
returns table (
  id             uuid,
  display_name   text,
  email          text,
  joined_at      timestamptz,
  current_streak int,
  longest_streak int,
  post_count     bigint,
  is_admin       boolean,
  deactivated_at timestamptz
)
language sql security definer
stable
as $$
  select
    p.id,
    p.display_name,
    u.email::text,
    p.created_at                   as joined_at,
    p.current_streak,
    p.longest_streak,
    count(po.id)::bigint           as post_count,
    p.is_admin,
    p.deactivated_at
  from profiles p
  join auth.users u on u.id = p.id
  left join posts po on po.user_id = p.id
  where
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
    and (
      p_search is null or p_search = ''
      or p.display_name ilike '%' || p_search || '%'
      or u.email        ilike '%' || p_search || '%'
    )
    and (
      p_filter = 'all'
      or (p_filter = 'week'        and p.created_at >= date_trunc('week', now()))
      or (p_filter = 'month'       and p.created_at >= date_trunc('month', now()))
      or (p_filter = 'deactivated' and p.deactivated_at is not null)
      or (p_filter = 'admin'       and p.is_admin = true)
    )
  group by p.id, p.display_name, u.email, p.created_at,
           p.current_streak, p.longest_streak, p.is_admin, p.deactivated_at
  order by p.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function admin_get_users(text, text, int, int) to authenticated;
