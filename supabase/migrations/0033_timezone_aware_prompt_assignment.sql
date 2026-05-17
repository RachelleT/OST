-- Fix assign_prompt_for_today to use the user's stored timezone when
-- computing "today", so users in non-UTC timezones get the right daily prompt.

create or replace function assign_prompt_for_today()
returns daily_assignments
language plpgsql security definer as $$
declare
  v_user_id  uuid := auth.uid();
  v_timezone text;
  v_today    date;
  v_existing daily_assignments;
  v_prompt_id uuid;
begin
  select coalesce(nullif(trim(timezone), ''), 'UTC')
    into v_timezone
    from profiles
    where id = v_user_id;

  v_today := (now() at time zone v_timezone)::date;

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

  -- Fallback: all prompts seen in the last year — start cycling
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
