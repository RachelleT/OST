-- Fix admin_audit: expand the action CHECK constraint to include all action
-- types added in M3 (prompt, note, post, and moderation actions).
-- The original constraint only allowed the 4 bootstrap/invite actions, so
-- every audit write from prompt/note/post RPCs has been failing.

alter table admin_audit
  drop constraint if exists admin_audit_action_check;

alter table admin_audit
  add constraint admin_audit_action_check
  check (action in (
    -- user management
    'promoted',
    'demoted',
    'invited',
    'bootstrap_auto',
    -- prompts
    'prompt_created',
    'prompt_edited',
    'prompt_deactivated',
    'prompt_reactivated',
    -- notes
    'note_created',
    'note_edited',
    'note_deactivated',
    'note_reactivated',
    -- posts
    'post_hidden',
    'post_unhidden',
    'post_featured',
    'post_unfeatured',
    -- moderation queue
    'post_approved',
    'post_moderation_ignored'
  ));
