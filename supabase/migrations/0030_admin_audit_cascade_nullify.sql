-- Add ON DELETE SET NULL to admin_audit foreign keys so that deleting a user
-- or profile doesn't block on audit log entries referencing them.

alter table admin_audit
  drop constraint if exists admin_audit_target_user_fkey;

alter table admin_audit
  add constraint admin_audit_target_user_fkey
  foreign key (target_user) references profiles(id)
  on delete set null;

alter table admin_audit
  drop constraint if exists admin_audit_actor_fkey;

alter table admin_audit
  add constraint admin_audit_actor_fkey
  foreign key (actor) references profiles(id)
  on delete set null;
