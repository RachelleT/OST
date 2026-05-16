-- M2.1: notes table for warm notes on the Today screen

create table notes (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(text) between 3 and 140),
  pool text not null check (pool in ('empty_state', 'completed_state')),
  day_of_week int check (day_of_week is null or day_of_week between 0 and 6),
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index on notes(pool, active) where active = true;

-- RLS
alter table notes enable row level security;

create policy "anyone reads active notes" on notes
  for select using (
    active = true or
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "admins write notes" on notes
  for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- Extend admin_audit: add target_note column and four new action types
alter table admin_audit add column if not exists target_note uuid references notes(id);

create index if not exists admin_audit_target_note_idx
  on admin_audit(target_note, created_at desc)
  where target_note is not null;

-- Re-create the action check constraint to include note actions
-- (drop the old constraint, add the new one with note action types)
alter table admin_audit drop constraint if exists admin_audit_action_check;

alter table admin_audit add constraint admin_audit_action_check
  check (action in (
    'promoted', 'demoted', 'invited', 'bootstrap_auto',
    'post_hidden', 'post_unhidden', 'post_featured', 'post_unfeatured',
    'prompt_created', 'prompt_edited', 'prompt_deactivated', 'prompt_reactivated',
    'note_created', 'note_edited', 'note_deactivated', 'note_reactivated'
  ));
