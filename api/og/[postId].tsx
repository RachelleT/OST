// og:image generator — returns a 1200×630 PNG via @vercel/og (Node.js runtime)
import { ImageResponse } from '@vercel/og'
import { createClient } from '@supabase/supabase-js'
import type { IncomingMessage, ServerResponse } from 'http'

const PALETTES: Record<number, { bg: string; accent: string; text: string }> = {
  0: { bg: '#F4C77B', accent: '#D9972A', text: '#412402' }, // Sunday
  1: { bg: '#2DBFA8', accent: '#1D9E75', text: '#04342C' }, // Monday
  2: { bg: '#FF7A59', accent: '#D95A38', text: '#4A1B0C' }, // Tuesday
  3: { bg: '#4D96FF', accent: '#2B6FCC', text: '#042C53' }, // Wednesday
  4: { bg: '#FF5C8A', accent: '#D93D6B', text: '#4B1528' }, // Thursday
  5: { bg: '#6FCF4D', accent: '#4BA82A', text: '#173404' }, // Friday
  6: { bg: '#9B7EDC', accent: '#7257B8', text: '#26215C' }, // Saturday
}

function getPalette(dateStr: string) {
  return PALETTES[new Date(dateStr + 'T12:00:00Z').getDay()] ?? PALETTES[1]
}

function truncate(text: string, max = 160) {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const postId = (req.url ?? '').split('/').pop() ?? ''
  const baseUrl = process.env.VITE_PUBLIC_BASE_URL ?? 'https://dayspark.yuvoice.com'
  const host = new URL(baseUrl).hostname

  let p = PALETTES[new Date().getDay()]
  let promptText = ''
  let postText = ''
  let authorName: string | null = null

  if (postId && postId !== 'fallback') {
    try {
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!,
      )
      const { data } = await supabase
        .from('featured_posts')
        .select('post_id,display_mode,posts(text,date,prompts(text),profiles(display_name,show_name_on_shared))')
        .eq('post_id', postId)
        .is('unfeatured_at', null)
        .maybeSingle()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data as any
      const post = row?.posts
      if (post) {
        p = getPalette(post.date as string)
        promptText = post.prompts?.text ?? ''
        postText = post.text ?? ''
        const showName = row.display_mode === 'with_name' && post.profiles?.show_name_on_shared
        authorName = showName ? (post.profiles?.display_name ?? null) : null
      }
    } catch { /* use fallback */ }
  }

  const imgResponse = new ImageResponse(
    postText ? (
      <div style={{ width: '100%', height: '100%', background: p.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 80px', position: 'relative' }}>
        {/* Blobs */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 280, height: 280, borderRadius: '50%', background: p.accent, opacity: 0.3, display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -70, left: -70, width: 220, height: 220, borderRadius: '50%', background: p.accent, opacity: 0.18, display: 'flex' }} />
        {/* Wordmark */}
        <div style={{ position: 'absolute', top: 40, left: 60, fontSize: 13, fontWeight: 700, letterSpacing: 8, color: p.text, opacity: 0.4, display: 'flex' }}>
          DAYSPARK · {host}
        </div>
        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 900 }}>
          {promptText ? (
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 4, color: p.text, opacity: 0.45, display: 'flex' }}>
              {promptText.toUpperCase()}
            </div>
          ) : null}
          <div style={{ fontSize: postText.length > 100 ? 38 : 48, fontWeight: 500, lineHeight: 1.3, color: p.text, textAlign: 'center', display: 'flex' }}>
            {truncate(postText)}
          </div>
          {authorName ? (
            <div style={{ fontSize: 20, color: p.text, opacity: 0.5, display: 'flex' }}>— {authorName}</div>
          ) : null}
        </div>
        {/* Footer */}
        <div style={{ position: 'absolute', bottom: 40, right: 60, fontSize: 13, fontWeight: 600, letterSpacing: 3, color: p.text, opacity: 0.3, display: 'flex' }}>
          FEATURED ON DAYSPARK
        </div>
      </div>
    ) : (
      <div style={{ width: '100%', height: '100%', background: p.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: 10, color: p.text, opacity: 0.55, display: 'flex' }}>DAYSPARK</div>
        <div style={{ fontSize: 22, color: p.text, opacity: 0.38, marginTop: 16, display: 'flex' }}>One prompt a day. Build something quiet.</div>
      </div>
    ),
    { width: 1200, height: 630 },
  )

  // Stream the ImageResponse (Web API Response) into the Node.js ServerResponse
  const arrayBuffer = await imgResponse.arrayBuffer()
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', postText ? 'public, max-age=86400, s-maxage=86400' : 'public, max-age=3600, s-maxage=3600')
  res.end(Buffer.from(arrayBuffer))
}
