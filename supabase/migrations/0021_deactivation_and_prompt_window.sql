-- 1. Extend prompt repeat window: no same prompt within 365 days
create or replace function assign_prompt_for_today()
returns daily_assignments
language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_existing daily_assignments;
  v_prompt_id uuid;
begin
  select * into v_existing from daily_assignments
    where user_id = v_user_id and date = v_today;
  if found then return v_existing; end if;

  select id into v_prompt_id from prompts
    where active = true
      and id not in (
        select prompt_id from daily_assignments
          where user_id = v_user_id and date > v_today - interval '365 days'
      )
    order by md5(v_user_id::text || v_today::text || id::text)
    limit 1;

  -- Fallback: all active prompts have been seen in the last year — start cycling
  if v_prompt_id is null then
    select id into v_prompt_id from prompts
      where active = true
      order by md5(v_user_id::text || v_today::text || id::text)
      limit 1;
  end if;

  insert into daily_assignments (user_id, date, prompt_id)
    values (v_user_id, v_today, v_prompt_id)
    returning * into v_existing;
  return v_existing;
end $$;

-- 2. Account deactivation column
alter table profiles add column if not exists deactivated_at timestamptz;

-- 3. RPCs — users can deactivate / reactivate their own account
create or replace function deactivate_account()
returns void
language plpgsql security definer as $$
begin
  update profiles set deactivated_at = now() where id = auth.uid();
end $$;

create or replace function reactivate_account()
returns void
language plpgsql security definer as $$
begin
  update profiles set deactivated_at = null where id = auth.uid();
end $$;
