-- Temporarily disable the handle_user_confirmed trigger
-- This trigger is causing database errors during user creation

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
