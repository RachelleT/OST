-- Prevent duplicate prompts at the database level.
-- Uses a unique index on the normalised text (lowercase + trimmed whitespace)
-- so "Same prompt" and "same prompt " are treated as the same.

create unique index if not exists prompts_text_unique
  on prompts (lower(trim(text)));
