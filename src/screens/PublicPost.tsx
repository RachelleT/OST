import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { dayPalette } from '../lib/palette'
import DayBackground from '../components/DayBackground'

interface FeaturedPost {
  post_id: string
  post_text: string | null
  photo_url: string | null
  prompt_text: string
  post_date: string
  display_mode: string
  author_name: string | null  // null = no byline
}

function Spinner() {
  return (
    <div style={{ minHeight: '100dvh', background: '#FAF5EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#2DBFA8', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function GonePage() {
  return (
    <div style={{ minHeight: '100dvh', background: '#FAF5EC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 40, marginBottom: 16 }}>✦</p>
      <p style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
        This post is no longer public
      </p>
      <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, maxWidth: 320 }}>
        It may have been taken down by its author or by a moderator.
      </p>
      <a
        href="/"
        style={{ marginTop: 32, fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#04342C', opacity: 0.6, textDecoration: 'none' }}
      >
        ← Dayspark
      </a>
    </div>
  )
}

function PostPhoto({ storagePath }: { storagePath: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    supabase.storage
      .from('post-photos')
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => { if (data) setSrc(data.signedUrl) })
  }, [storagePath])

  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      style={{ width: '100%', maxWidth: 480, borderRadius: 16, objectFit: 'cover', maxHeight: 360 }}
    />
  )
}

export default function PublicPost() {
  const { postId } = useParams<{ postId: string }>()
  const { user } = useAuth()
  const [post, setPost] = useState<FeaturedPost | null | undefined>(undefined)

  useEffect(() => {
    if (!postId) { setPost(null); return }

    // Query directly (no RPC) using RLS policies that allow anon access
    // to featured public approved posts.
    supabase
      .from('featured_posts')
      .select(`
        post_id,
        display_mode,
        posts (
          text,
          photo_url,
          date,
          prompts ( text ),
          profiles ( display_name, show_name_on_shared )
        )
      `)
      .eq('post_id', postId)
      .is('unfeatured_at', null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[PublicPost] query error:', error)
          setPost(null)
          return
        }
        if (!data) { setPost(null); return }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = data as any
        const p = row.posts
        const showName =
          row.display_mode === 'with_name' && p?.profiles?.show_name_on_shared
        setPost({
          post_id:      row.post_id,
          post_text:    p?.text ?? null,
          photo_url:    p?.photo_url ?? null,
          prompt_text:  p?.prompts?.text ?? '',
          post_date:    p?.date ?? '',
          display_mode: row.display_mode,
          author_name:  showName ? (p?.profiles?.display_name ?? null) : null,
        })
      })
  }, [postId])

  if (post === undefined) return <Spinner />
  if (!post) return <GonePage />

  const palette = dayPalette(parseISO(post.post_date + 'T12:00:00'))

  return (
    <div style={{ minHeight: '100dvh', background: palette.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Full-bleed coloured background with shapes */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <DayBackground palette={palette} />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>

        {/* Top bar: wordmark */}
        <div style={{ padding: '24px 24px 0' }}>
          <a
            href="/"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: palette.textOnBg,
              opacity: 0.55,
              textDecoration: 'none',
            }}
          >
            DAYSPARK
          </a>
        </div>

        {/* Main content — vertically centred, max 640px */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
          textAlign: 'center',
          gap: 20,
        }}>

          {/* Prompt label */}
          <p style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: palette.textOnBg,
            opacity: 0.5,
            margin: 0,
          }}>
            {post.prompt_text}
          </p>

          {/* Post text */}
          {post.post_text && (
            <p style={{
              fontSize: 'clamp(22px, 5vw, 28px)',
              fontWeight: 500,
              lineHeight: 1.35,
              color: palette.textOnBg,
              letterSpacing: '-0.3px',
              margin: 0,
            }}>
              {post.post_text}
            </p>
          )}

          {/* Photo */}
          {post.photo_url && <PostPhoto storagePath={post.photo_url} />}

          {/* Author */}
          {post.author_name && (
            <p style={{
              fontSize: 14,
              fontWeight: 500,
              color: palette.textOnBg,
              opacity: 0.6,
              margin: 0,
            }}>
              — {post.author_name}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0 24px 32px', textAlign: 'center' }}>
          <a
            href="/"
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: palette.textOnBg,
              opacity: 0.45,
              textDecoration: 'none',
            }}
          >
            Featured on Dayspark · Read more →
          </a>
        </div>
      </div>

      {/* Floating CTA for signed-in users */}
      {user && (
        <Link
          to="/"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 20,
            zIndex: 10,
            fontSize: 13,
            fontWeight: 600,
            color: palette.bg,
            background: palette.textOnBg,
            padding: '10px 18px',
            borderRadius: 9999,
            textDecoration: 'none',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            opacity: 0.9,
          }}
        >
          Open in app →
        </Link>
      )}
    </div>
  )
}
