import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { dayPalette } from '../lib/palette'

export interface FeedPost {
  post_id: string
  user_id: string
  post_text: string | null
  photo_url: string | null
  prompt_text: string
  post_date: string          // ISO date string
  created_at: string         // ISO timestamp
  display_name: string | null
  reaction_count: number
  user_reacted: boolean
}

interface Props {
  post: FeedPost
  onReactionToggle: (postId: string, newState: boolean) => void
}

function RelativeTime({ iso }: { iso: string }) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)                        return <span>just now</span>
  if (diff < 3600)                      return <span>{Math.floor(diff / 60)}m ago</span>
  if (diff < 86400)                     return <span>{Math.floor(diff / 3600)}h ago</span>
  const days = Math.floor(diff / 86400)
  if (days === 1)                       return <span>yesterday</span>
  if (days < 30)                        return <span>{days} days ago</span>
  return <span>{Math.floor(days / 30)}mo ago</span>
}

function PostPhoto({ storagePath }: { storagePath: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.storage
      .from('post-photos')
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => {
        if (!cancelled && data) setSrc(data.signedUrl)
      })
    return () => { cancelled = true }
  }, [storagePath])

  if (!src) return <div className="w-full h-40 rounded-xl bg-gray-100 animate-pulse mt-3" />
  return (
    <img
      src={src}
      alt=""
      className="w-full rounded-xl object-cover mt-3"
      style={{ maxHeight: 320 }}
    />
  )
}

export default function FeedPostCard({ post, onReactionToggle }: Props) {
  const [reacting, setReacting] = useState(false)
  const palette = dayPalette(new Date(post.post_date + 'T12:00:00'))

  async function handleReaction() {
    if (reacting) return
    setReacting(true)
    // Optimistic update
    onReactionToggle(post.post_id, !post.user_reacted)
    try {
      const { error } = await supabase.rpc('toggle_reaction', { target_post_id: post.post_id })
      if (error) {
        // Revert on failure
        onReactionToggle(post.post_id, post.user_reacted)
      }
    } catch {
      onReactionToggle(post.post_id, post.user_reacted)
    } finally {
      setReacting(false)
    }
  }

  return (
    <article className="bg-white rounded-[18px] p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Prompt — small accent label using the post's day colour */}
      <p
        className="text-xs font-medium mb-2 leading-snug"
        style={{ color: palette.accent }}
      >
        {post.prompt_text}
      </p>

      {/* Post text */}
      {post.post_text && (
        <p className="text-sm text-gray-800 leading-relaxed">
          {post.post_text}
        </p>
      )}

      {/* Photo */}
      {post.photo_url && <PostPhoto storagePath={post.photo_url} />}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        {/* Author + time */}
        <p className="text-xs text-gray-400">
          {post.display_name
            ? <><span className="text-gray-600 font-medium">— {post.display_name}</span> · <RelativeTime iso={post.created_at} /></>
            : <RelativeTime iso={post.created_at} />
          }
        </p>

        {/* Reaction button */}
        <button
          type="button"
          onClick={handleReaction}
          disabled={reacting}
          aria-pressed={post.user_reacted}
          aria-label={post.user_reacted ? 'Remove reaction' : 'React with sparkle'}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60"
          style={post.user_reacted
            ? { background: palette.accent, color: '#fff' }
            : { background: 'transparent', border: `1.5px solid ${palette.accent}`, color: palette.accent }
          }
        >
          <span aria-hidden="true">✨</span>
          {post.reaction_count > 0 && <span>{post.reaction_count}</span>}
        </button>
      </div>
    </article>
  )
}
