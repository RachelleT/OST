// Serverless function for /p/:postId
// Serves the SPA's index.html with og meta tags injected in <head>
// so social crawlers (Twitter, iMessage, WhatsApp, etc.) see the preview.
// Actual rendering is still handled client-side by PublicPost.tsx.

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const postId = req.query.postId as string
  const baseUrl = process.env.VITE_PUBLIC_BASE_URL ?? 'https://dayspark.yuvoice.com'

  // Default og tags (used if post not found or on error)
  let ogTitle = 'Dayspark'
  let ogDescription = 'One prompt a day. Build something quiet, just for you.'
  let ogImage = `${baseUrl}/api/og/fallback`
  const ogUrl = `${baseUrl}/p/${postId}`

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
    )

    const { data } = await supabase
      .from('featured_posts')
      .select('post_id, display_mode, posts(text, date, prompts(text))')
      .eq('post_id', postId)
      .is('unfeatured_at', null)
      .maybeSingle()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any
    const post = row?.posts

    if (post) {
      const text: string = post.text ?? ''
      const prompt: string = post.prompts?.text ?? ''
      ogTitle = `Dayspark — ${text.slice(0, 50)}${text.length > 50 ? '…' : ''}`
      ogDescription = prompt
      ogImage = `${baseUrl}/api/og/${postId}`
    }
  } catch {
    // Fall through to default tags
  }

  // Read the built index.html and inject og tags into <head>
  let html: string
  try {
    html = readFileSync(join(process.cwd(), 'dist/index.html'), 'utf-8')
  } catch {
    // Fallback if dist isn't available (local dev)
    res.redirect(`/p/${postId}`)
    return
  }

  const ogTags = `
    <meta property="og:title" content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(ogDescription)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:url" content="${ogUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Dayspark" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
    <meta name="twitter:image" content="${ogImage}" />
  `

  // Inject just before </head>
  const injected = html.replace('</head>', `${ogTags}</head>`)

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  res.status(200).send(injected)
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
