-- Remove is_admin from admin_get_users return type (admins are managed on
-- the dedicated Admins page) and drop the unused 'admin' filter option.
-- Must drop first because PostgreSQL cannot change a function's return type in place.

drop function if exists admin_get_users(text, text, int, int);

create or replace function admin_get_users(
  p_search   text default null,
  p_filter   text default 'all',   -- 'all' | 'week' | 'month' | 'deactivated'
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
    )
  group by p.id, p.display_name, u.email, p.created_at,
           p.current_streak, p.longest_streak, p.deactivated_at
  order by p.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function admin_get_users(text, text, int, int) to authenticated;
