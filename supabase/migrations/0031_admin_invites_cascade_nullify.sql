-- Fix admin_invites foreign keys so that deleting a user doesn't block
-- on invite records they sent or consumed.
-- invited_by: set null (preserve the invite record, just lose the sender reference)
-- consumed_by: set null (already nullable, just add the cascade rule)

alter table admin_invites
  drop constraint if exists admin_invites_invited_by_fkey;

alter table admin_invites
  add constraint admin_invites_invited_by_fkey
  foreign key (invited_by) references profiles(id)
  on delete set null;

-- invited_by is NOT NULL — relax that since we're allowing set null on delete
alter table admin_invites
  alter column invited_by drop not null;

alter table admin_invites
  drop constraint if exists admin_invites_consumed_by_fkey;

alter table admin_invites
  add constraint admin_invites_consumed_by_fkey
  foreign key (consumed_by) references profiles(id)
  on delete set null;
