import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const baseUrl = process.env.VITE_PUBLIC_BASE_URL ?? 'https://dayspark.yuvoice.com'

  let featuredUrls = ''
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
    )
    const { data } = await supabase
      .from('featured_posts')
      .select('post_id, featured_at')
      .is('unfeatured_at', null)

    featuredUrls = (data ?? [])
      .map((p: Record<string, string>) => `  <url>
    <loc>${baseUrl}/p/${p.post_id}</loc>
    <priority>0.6</priority>
    ${p.featured_at ? `<lastmod>${p.featured_at.slice(0, 10)}</lastmod>` : ''}
  </url>`)
      .join('\n')
  } catch { /* skip featured posts on error */ }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <priority>1.0</priority>
  </url>
${featuredUrls}
</urlset>`

  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(xml)
}
