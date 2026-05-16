-- Fix admin_audit: make target_user nullable and add missing target columns.
-- The original table required target_user NOT NULL, but prompt/note/post audit
-- rows don't have a target user — they target a prompt, note, or post instead.

alter table admin_audit alter column target_user drop not null;

alter table admin_audit add column if not exists target_prompt uuid references prompts(id);
alter table admin_audit add column if not exists target_post   uuid references posts(id);

create index if not exists admin_audit_target_prompt_idx
  on admin_audit(target_prompt, created_at desc)
  where target_prompt is not null;

create index if not exists admin_audit_target_post_idx
  on admin_audit(target_post, created_at desc)
  where target_post is not null;
