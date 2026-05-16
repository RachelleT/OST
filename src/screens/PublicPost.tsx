import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { dayPalette } from '../lib/palette'
import DayBackground from '../components/DayBackground'

interface FeaturedPost {
  post_id: string
  post_text: string | null
  prompt_text: string
  post_date: string
  display_mode: string
  author_name: string | null
}

export default function PublicPost() {
  const { postId } = useParams<{ postId: string }>()
  const [post, setPost] = useState<FeaturedPost | null | undefined>(undefined) // undefined = loading

  useEffect(() => {
    if (!postId) { setPost(null); return }
    supabase
      .rpc('get_featured_post', { p_post_id: postId })
      .then(({ data }) => {
        const rows = data as FeaturedPost[] | null
        setPost(rows?.[0] ?? null)
      })
  }, [postId])

  if (post === undefined) {
    return (
      <div style={{ minHeight: '100dvh', background: '#FAF5EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#2DBFA8', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!post) {
    return (
      <div style={{ minHeight: '100dvh', background: '#FAF5EC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>Post not found</p>
        <p style={{ fontSize: 14, color: '#6b7280' }}>This post may have been removed or is no longer featured.</p>
        <a href="/" style={{ marginTop: 24, fontSize: 14, fontWeight: 500, color: '#04342C' }}>← one small thing</a>
      </div>
    )
  }

  const palette = dayPalette(parseISO(post.post_date + 'T12:00:00'))

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FAF5EC' }}>

      {/* Colored hero */}
      <div style={{ position: 'relative', overflow: 'hidden', background: palette.bg }}>
        <DayBackground palette={palette} />

        <div style={{ position: 'relative', zIndex: 1, padding: '48px 24px 40px' }}>

          {/* Prompt */}
          <p style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: palette.textOnBg,
            opacity: 0.55,
            marginBottom: 16,
          }}>
            {post.prompt_text}
          </p>

          {/* Post text */}
          {post.post_text && (
            <p style={{
              fontSize: 24,
              fontWeight: 500,
              lineHeight: 1.3,
              color: palette.textOnBg,
              letterSpacing: '-0.3px',
              marginBottom: 24,
            }}>
              {post.post_text}
            </p>
          )}

          {/* Author */}
          {post.display_mode === 'with_name' && post.author_name && (
            <p style={{ fontSize: 14, fontWeight: 500, color: palette.textOnBg, opacity: 0.65 }}>
              — {post.author_name}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '32px 24px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#04342C', opacity: 0.3, marginTop: 'auto' }}>
          one small thing, every day ✦
        </p>
      </div>
    </div>
  )
}
