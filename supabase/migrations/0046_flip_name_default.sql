-- Flip name attribution default: show name by default, allow users to hide it
-- Change show_name_on_shared default from FALSE to TRUE

ALTER TABLE profiles
ALTER COLUMN show_name_on_shared SET DEFAULT true;

-- Set all existing users to show their name (new default behavior)
UPDATE profiles
SET show_name_on_shared = true
WHERE show_name_on_shared IS FALSE;
