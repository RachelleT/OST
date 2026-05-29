// og:image generator — returns a plain SVG card (no @vercel/og needed)
// SVGs work as og:images in iMessage, WhatsApp, Slack, Telegram, Facebook, LinkedIn.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Wrap text into lines of ~maxChars chars, max 4 lines
function wrapText(text: string, maxChars = 40, maxLines = 4): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (lines.length >= maxLines) break
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current)
      current = word
    } else {
      current = (current + ' ' + word).trim()
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  if (lines.length === maxLines && text.length > lines.join(' ').length + 3) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 3) + '…'
  }
  return lines
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const postId = (req.query.postId as string) ?? ''
  const baseUrl = process.env.VITE_PUBLIC_BASE_URL ?? 'https://dayspark.yuvoice.com'
  const host = new URL(baseUrl).hostname

  let p = PALETTES[new Date().getDay()]
  let promptText = ''
  let postLines: string[] = []
  let authorName: string | null = null
  let hasPost = false

  if (postId !== 'fallback') {
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
        hasPost = true
        p = getPalette(post.date)
        promptText = post.prompts?.text ?? ''
        postLines = wrapText(post.text ?? '', 44, 4)
        const showName = row.display_mode === 'with_name' && post.profiles?.show_name_on_shared
        authorName = showName ? (post.profiles?.display_name ?? null) : null
      }
    } catch { /* fallback card */ }
  }

  const W = 1200
  const H = 630
  const cx = W / 2
  const cy = H / 2

  // Layout: prompt at cy-110, post text centered around cy, author at cy+130
  const fontSize = postLines.length > 2 ? 52 : 62
  const lineH = fontSize * 1.3
  const textStartY = cy - ((postLines.length - 1) * lineH) / 2

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${p.bg}"/>

  <!-- Decorative blobs -->
  <circle cx="${W + 40}" cy="-40" r="200" fill="${p.accent}" opacity="0.3"/>
  <circle cx="-60" cy="${H + 60}" r="160" fill="${p.accent}" opacity="0.18"/>

  <!-- Wordmark -->
  <text x="60" y="54" font-family="system-ui,-apple-system,sans-serif" font-size="14" font-weight="700" letter-spacing="8" fill="${p.text}" opacity="0.4">DAYSPARK · ${escapeXml(host)}</text>

  ${!hasPost ? `
  <!-- Fallback -->
  <text x="${cx}" y="${cy - 20}" font-family="system-ui,-apple-system,sans-serif" font-size="64" font-weight="700" letter-spacing="10" text-anchor="middle" fill="${p.text}" opacity="0.55">DAYSPARK</text>
  <text x="${cx}" y="${cy + 44}" font-family="system-ui,-apple-system,sans-serif" font-size="22" text-anchor="middle" fill="${p.text}" opacity="0.38">One prompt a day. Build something quiet.</text>
  ` : `
  <!-- Prompt -->
  ${promptText ? `<text x="${cx}" y="${textStartY - 52}" font-family="system-ui,-apple-system,sans-serif" font-size="15" font-weight="600" letter-spacing="4" text-anchor="middle" fill="${p.text}" opacity="0.45" text-transform="uppercase">${escapeXml(promptText.toUpperCase())}</text>` : ''}

  <!-- Post text lines -->
  ${postLines.map((line, i) => `<text x="${cx}" y="${textStartY + i * lineH}" font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="500" text-anchor="middle" fill="${p.text}" opacity="0.9">${escapeXml(line)}</text>`).join('\n  ')}

  <!-- Author -->
  ${authorName ? `<text x="${cx}" y="${textStartY + postLines.length * lineH + 32}" font-family="system-ui,-apple-system,sans-serif" font-size="22" text-anchor="middle" fill="${p.text}" opacity="0.5">— ${escapeXml(authorName)}</text>` : ''}
  `}

  <!-- Footer -->
  <text x="${W - 60}" y="${H - 36}" font-family="system-ui,-apple-system,sans-serif" font-size="14" font-weight="600" letter-spacing="3" text-anchor="end" fill="${p.text}" opacity="0.3">FEATURED ON DAYSPARK</text>
</svg>`

  res.setHeader('Content-Type', 'image/svg+xml')
  res.setHeader('Cache-Control', hasPost ? 'public, max-age=86400, s-maxage=86400' : 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(svg)
}
