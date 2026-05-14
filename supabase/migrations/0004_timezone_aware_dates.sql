-- M2 Step 1: make assign_prompt_for_today timezone-aware.
-- Instead of current_date (UTC server time), compute "today" in the
-- user's own timezone by reading profiles.timezone.

create or replace function assign_prompt_for_today()
returns daily_assignments
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_timezone text;
  v_today    date;
  v_existing daily_assignments;
  v_prompt_id uuid;
begin
  -- Look up the user's stored timezone (defaults to 'UTC')
  select coalesce(nullif(timezone, ''), 'UTC')
    into v_timezone
    from profiles
   where id = v_user_id;

  -- Compute today in the user's timezone
  v_today := (current_timestamp at time zone v_timezone)::date;

  -- Return existing assignment if already generated today
  select * into v_existing
    from daily_assignments
   where user_id = v_user_id and date = v_today;
  if found then return v_existing; end if;

  -- Pick a prompt not seen in the last 30 days
  select id into v_prompt_id
    from prompts
   where active = true
     and id not in (
       select prompt_id from daily_assignments
        where user_id = v_user_id
          and date > v_today - interval '30 days'
     )
   order by md5(v_user_id::text || v_today::text || id::text)
   limit 1;

  -- Fallback: pool too small, pick any active prompt
  if v_prompt_id is null then
    select id into v_prompt_id
      from prompts
     where active = true
     order by md5(v_user_id::text || v_today::text || id::text)
     limit 1;
  end if;

  insert into daily_assignments (user_id, date, prompt_id)
    values (v_user_id, v_today, v_prompt_id)
    returning * into v_existing;

  return v_existing;
end $$;
