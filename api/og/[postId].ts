import { ImageResponse } from '@vercel/og'
import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

// Palette mirrored from src/lib/palette.ts (can't import across Edge boundary)
const PALETTES: Record<number, { bg: string; accent: string; text: string }> = {
  0: { bg: '#F4C77B', accent: '#D9972A', text: '#412402' }, // Sunday
  1: { bg: '#2DBFA8', accent: '#1D9E75', text: '#04342C' }, // Monday
  2: { bg: '#FF7A59', accent: '#D95A38', text: '#4A1B0C' }, // Tuesday
  3: { bg: '#4D96FF', accent: '#2B6FCC', text: '#042C53' }, // Wednesday
  4: { bg: '#FF5C8A', accent: '#D93D6B', text: '#4B1528' }, // Thursday
  5: { bg: '#6FCF4D', accent: '#4BA82A', text: '#173404' }, // Friday
  6: { bg: '#9B7EDC', accent: '#7257B8', text: '#26215C' }, // Saturday
}

function palette(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00Z')
  return PALETTES[d.getDay()] ?? PALETTES[1]
}

function truncate(text: string, max = 180) {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const postId = url.pathname.split('/').pop()?.replace('.png', '') ?? ''

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
  )

  const { data } = await supabase
    .from('featured_posts')
    .select(`
      post_id,
      display_mode,
      posts (
        text,
        date,
        prompts ( text ),
        profiles ( display_name, show_name_on_shared )
      )
    `)
    .eq('post_id', postId)
    .is('unfeatured_at', null)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any
  const post = row?.posts

  const baseUrl = process.env.VITE_PUBLIC_BASE_URL ?? 'https://dayspark.yuvoice.com'
  const host = new URL(baseUrl).hostname

  // ── Fallback card (no featured post) ───────────────────────────────────────
  if (!post) {
    const today = new Date()
    const p = PALETTES[today.getDay()]
    return new ImageResponse(
      <div
        style={{
          width: '100%', height: '100%',
          background: p.bg,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 64, color: p.text, opacity: 0.15, marginBottom: 16 }}>✦</div>
        <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '0.12em', color: p.text, opacity: 0.6 }}>
          DAYSPARK
        </div>
        <div style={{ fontSize: 18, color: p.text, opacity: 0.4, marginTop: 12 }}>
          One prompt a day. Build something quiet.
        </div>
      </div>,
      {
        width: 1200, height: 630,
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
      },
    )
  }

  const p = palette(post.date)
  const promptText: string = post.prompts?.text ?? ''
  const postText: string = post.text ?? ''
  const showName = row.display_mode === 'with_name' && post.profiles?.show_name_on_shared
  const authorName: string | null = showName ? (post.profiles?.display_name ?? null) : null

  return new ImageResponse(
    <div
      style={{
        width: '100%', height: '100%',
        background: p.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 80px',
        position: 'relative',
      }}
    >
      {/* Decorative corner blob */}
      <div
        style={{
          position: 'absolute', top: -40, right: -40,
          width: 260, height: 260, borderRadius: '50%',
          background: p.accent, opacity: 0.35,
        }}
      />
      <div
        style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: p.accent, opacity: 0.2,
        }}
      />

      {/* Wordmark */}
      <div
        style={{
          position: 'absolute', top: 40, left: 60,
          fontSize: 13, fontWeight: 700, letterSpacing: '0.14em',
          color: p.text, opacity: 0.45,
        }}
      >
        DAYSPARK · {host}
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 900 }}>
        {/* Prompt */}
        {promptText && (
          <div
            style={{
              fontSize: 14, fontWeight: 600, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: p.text, opacity: 0.5,
            }}
          >
            {promptText}
          </div>
        )}

        {/* Post text */}
        <div
          style={{
            fontSize: postText.length > 100 ? 36 : 44,
            fontWeight: 500,
            lineHeight: 1.3,
            color: p.text,
            textAlign: 'center',
            letterSpacing: '-0.3px',
          }}
        >
          {truncate(postText)}
        </div>

        {/* Author */}
        {authorName && (
          <div style={{ fontSize: 18, color: p.text, opacity: 0.55, fontWeight: 500 }}>
            — {authorName}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute', bottom: 40, right: 60,
          fontSize: 13, fontWeight: 600, letterSpacing: '0.06em',
          color: p.text, opacity: 0.35,
        }}
      >
        Featured on Dayspark
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
    },
  )
}
