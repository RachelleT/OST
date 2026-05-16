import { useEffect, useState, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { dayPalette } from '../../lib/palette'

interface FeaturedRow {
  id: string
  post_id: string
  display_mode: string
  featured_at: string
  posts: {
    text: string | null
    date: string
    user_id: string
    profiles: { display_name: string } | null
    prompts: { text: string } | null
  } | null
}

const ACCENT = '#04342C'

export default function AdminFeatured() {
  const [rows, setRows] = useState<FeaturedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [unfeaturing, setUnfeaturing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('featured_posts')
      .select('id, post_id, display_mode, featured_at, posts(text, date, user_id, profiles(display_name), prompts(text))')
      .is('unfeatured_at', null)
      .order('featured_at', { ascending: false })
    setRows((data as unknown as FeaturedRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleUnfeature(postId: string) {
    setUnfeaturing(postId)
    await supabase.rpc('unfeature_post', { p_post_id: postId })
    setUnfeaturing(null)
    load()
  }

  function copyLink(postId: string) {
    navigator.clipboard.writeText(`${window.location.origin}/p/${postId}`)
  }

  if (loading) {
    return (
      <div className="px-5 py-8 w-full max-w-3xl">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Featured</h1>
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 py-8 w-full max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Featured</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">
          No featured posts yet. Feature a post from the Posts screen.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const post = row.posts
            if (!post) return null
            const palette = dayPalette(parseISO(post.date + 'T12:00:00'))
            const isAnon = row.display_mode === 'anonymous'

            return (
              <div key={row.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5" style={{ background: palette.bg }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-gray-700">
                        {isAnon ? 'Anonymous' : (post.profiles?.display_name ?? '—')}
                      </span>
                      <span className="text-xs text-gray-400">
                        {format(parseISO(post.date + 'T12:00:00'), 'MMM d')}
                      </span>
                      <span
                        className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                        style={{ background: isAnon ? '#f3f4f6' : '#E1F5EE', color: isAnon ? '#6b7280' : ACCENT }}
                      >
                        {isAnon ? 'Anonymous' : 'With name'}
                      </span>
                    </div>
                    {post.prompts?.text && (
                      <p className="text-xs text-gray-400 italic truncate mb-0.5">{post.prompts.text}</p>
                    )}
                    {post.text && (
                      <p className="text-sm text-gray-700 line-clamp-2 leading-snug">{post.text}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Featured {format(parseISO(row.featured_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => copyLink(row.post_id)}
                    className="flex-1 rounded-lg py-1.5 text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Copy link
                  </button>
                  <button
                    onClick={() => handleUnfeature(row.post_id)}
                    disabled={unfeaturing === row.post_id}
                    className="flex-1 rounded-lg py-1.5 text-xs font-medium border disabled:opacity-40"
                    style={{ borderColor: '#fca5a5', color: '#dc2626', background: '#fff5f5' }}
                  >
                    {unfeaturing === row.post_id ? '…' : 'Unfeature'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
