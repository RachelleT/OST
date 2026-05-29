-- Fix get_featured_post: rewrite as LANGUAGE plpgsql (removing STABLE + LANGUAGE SQL
-- which caused PostgREST to return 404 when called via supabase.rpc()).

drop function if exists get_featured_post(uuid);

create or replace function get_featured_post(p_post_id uuid)
returns table(
  post_id      uuid,
  post_text    text,
  photo_url    text,
  prompt_text  text,
  post_date    text,
  display_mode text,
  author_name  text
)
language plpgsql
security definer as $$
begin
  return query
    select
      fp.post_id,
      p.text,
      p.photo_url,
      pr.text,
      p.date::text,
      fp.display_mode,
      case
        when fp.display_mode = 'with_name' and prof.show_name_on_shared
        then prof.display_name
        else null::text
      end
    from featured_posts fp
    join posts    p    on p.id    = fp.post_id
    join prompts  pr   on pr.id   = p.prompt_id
    join profiles prof on prof.id = p.user_id
    where fp.post_id          = p_post_id
      and fp.unfeatured_at    is null
      and p.moderation_status != 'hidden'
      and p.is_public         = true
    limit 1;
end $$;

grant execute on function get_featured_post(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
