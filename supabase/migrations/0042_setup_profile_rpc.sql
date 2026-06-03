-- RPC to set up or update user profile during onboarding
-- Handles both creating a new profile (if trigger failed) and updating it

create or replace function setup_user_profile(
  p_display_name text,
  p_reminder_time time
)
returns void
language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Try to update existing profile
  update profiles
  set display_name = p_display_name,
      reminder_time = p_reminder_time
  where id = v_user_id;

  -- If no rows were updated, the profile doesn't exist, so create it
  if not found then
    insert into profiles (id, display_name, timezone, reminder_time, is_admin)
    values (v_user_id, p_display_name, 'UTC', p_reminder_time, false);
  end if;
end $$;
