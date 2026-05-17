-- Fix "column reference id is ambiguous" in get_admin_list.
-- PL/pgSQL puts RETURNS TABLE output columns in scope as variables, causing
-- ambiguity with same-named table columns. Rewriting in LANGUAGE SQL avoids this.

create or replace function get_admin_list()
returns table(
  id           uuid,
  display_name text,
  email        text,
  is_bootstrap boolean,
  promoted_at  timestamptz
)
language sql security definer
stable
as $$
  select
    p.id,
    p.display_name,
    au.email::text,
    case
      when length(coalesce((select value from config where key = 'bootstrap_admin_emails'), '')) > 0
      then exists (
        select 1
        from unnest(string_to_array(
          (select value from config where key = 'bootstrap_admin_emails'), ','
        )) as bootstrap_email
        where lower(trim(bootstrap_email)) = lower(trim(au.email))
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
$$;

grant execute on function get_admin_list() to authenticated;
