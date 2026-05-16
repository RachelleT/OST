import { useEffect, useState, useCallback } from 'react'
import { format, startOfWeek } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { dayPalette } from '../../lib/palette'

// ── Types ──────────────────────────────────────────────────────────────────

interface AdminPost {
  id: string
  date: string
  text: string | null
  photo_url: string | null
  moderation_status: string
  share_anonymous: boolean
  share_with_name: boolean
  created_at: string
  profiles: { display_name: string } | null
  prompts: { text: string } | null
}

interface Metrics {
  totalUsers: number
  postsToday: number
  postsThisWeek: number
  hiddenPosts: number
}

type FilterTab = 'today' | 'week' | 'all' | 'hidden'

// ── Helpers ────────────────────────────────────────────────────────────────

const ACCENT = '#04342C'
const PAGE_SIZE = 50

function todayUTC() {
  return new Date().toISOString().slice(0, 10)
}

function weekStartUTC() {
  const d = startOfWeek(new Date(), { weekStartsOn: 1 })
  return d.toISOString().slice(0, 10)
}

// ── Metrics widget ─────────────────────────────────────────────────────────

function MetricsBar({ metrics }: { metrics: Metrics | null }) {
  const items = [
    { label: 'Total users',    value: metrics?.totalUsers   ?? '—' },
    { label: 'Posts today',    value: metrics?.postsToday   ?? '—' },
    { label: 'Posts this week',value: metrics?.postsThisWeek ?? '—' },
    { label: 'Hidden',         value: metrics?.hiddenPosts  ?? '—' },
  ]
  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {items.map(({ label, value }) => (
        <div key={label} className="rounded-2xl bg-white p-3 text-center shadow-sm">
          <p className="text-xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Action sheet ───────────────────────────────────────────────────────────

function PostActionSheet({
  post,
  onClose,
  onHideToggle,
}: {
  post: AdminPost
  onClose: () => void
  onHideToggle: (post: AdminPost) => Promise<void>
}) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const isHidden = post.moderation_status === 'hidden'
  const palette = dayPalette(new Date(post.date + 'T12:00:00'))

  useEffect(() => {
    if (!post.photo_url) return
    supabase.storage
      .from('post-photos')
      .createSignedUrl(post.photo_url, 3600)
      .then(({ data }) => { if (data) setPhotoSrc(data.signedUrl) })
  }, [post.photo_url])

  async function handleHideToggle() {
    setWorking(true)
    await onHideToggle(post)
    setWorking(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header strip using day palette */}
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: palette.bg }}>
          <div>
            <p className="text-xs font-semibold" style={{ color: palette.textOnBg }}>
              {post.profiles?.display_name ?? 'Unknown'}
            </p>
            <p className="text-xs opacity-70" style={{ color: palette.textOnBg }}>
              {format(new Date(post.date + 'T12:00:00'), 'EEEE, MMMM d')}
            </p>
          </div>
          <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100" style={{ color: palette.textOnBg }}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Prompt */}
          {post.prompts?.text && (
            <p className="text-xs text-gray-400 italic">{post.prompts.text}</p>
          )}

          {/* Post text */}
          {post.text && (
            <p className="text-sm text-gray-800 leading-relaxed">{post.text}</p>
          )}

          {/* Photo */}
          {post.photo_url && (
            photoSrc
              ? <img src={photoSrc} alt="" className="w-full rounded-2xl object-cover" style={{ maxHeight: 240 }} />
              : <div className="w-full h-32 rounded-2xl bg-gray-100 animate-pulse" />
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-2">
            {isHidden && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">Hidden</span>
            )}
            {post.share_anonymous && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Anon share on</span>
            )}
            {post.share_with_name && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Named share on</span>
            )}
            {!post.share_anonymous && !post.share_with_name && (
              <span className="text-xs text-gray-400">Fully private</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 space-y-2 border-t border-gray-100">
          <button
            onClick={handleHideToggle}
            disabled={working}
            className="w-full rounded-xl py-2.5 text-sm font-medium border disabled:opacity-40"
            style={isHidden
              ? { borderColor: ACCENT, color: ACCENT }
              : { borderColor: '#fca5a5', color: '#dc2626', background: '#fff5f5' }
            }
          >
            {working ? '…' : isHidden ? 'Unhide post' : 'Hide post'}
          </button>
          <button
            disabled
            className="w-full rounded-xl py-2.5 text-sm font-medium border border-gray-200 text-gray-300"
            title="Coming in Step 4"
          >
            Feature on website (Step 4)
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function AdminPosts() {
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<FilterTab>('today')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [selected, setSelected] = useState<AdminPost | null>(null)

  const loadMetrics = useCallback(async () => {
    const today = todayUTC()
    const weekStart = weekStartUTC()

    const [{ count: users }, { count: postsToday }, { count: postsWeek }, { count: hidden }] =
      await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('date', today),
        supabase.from('posts').select('id', { count: 'exact', head: true }).gte('date', weekStart),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('moderation_status', 'hidden'),
      ])

    setMetrics({
      totalUsers: users ?? 0,
      postsToday: postsToday ?? 0,
      postsThisWeek: postsWeek ?? 0,
      hiddenPosts: hidden ?? 0,
    })
  }, [])

  const loadPosts = useCallback(async (currentTab: FilterTab, searchText: string, pageNum: number) => {
    setLoading(true)
    let q = supabase
      .from('posts')
      .select('id, date, text, photo_url, moderation_status, share_anonymous, share_with_name, created_at, profiles(display_name), prompts(text)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (currentTab === 'today')  q = q.eq('date', todayUTC())
    if (currentTab === 'week')   q = q.gte('date', weekStartUTC())
    if (currentTab === 'hidden') q = q.eq('moderation_status', 'hidden')
    if (searchText.trim())       q = q.ilike('text', `%${searchText.trim()}%`)

    const { data } = await q
    const rows = (data as unknown as AdminPost[]) ?? []

    if (pageNum === 0) {
      setPosts(rows)
    } else {
      setPosts(prev => [...prev, ...rows])
    }
    setHasMore(rows.length === PAGE_SIZE)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  useEffect(() => {
    setPage(0)
    loadPosts(tab, search, 0)
  }, [tab, search, loadPosts])

  async function handleHideToggle(post: AdminPost) {
    if (post.moderation_status === 'hidden') {
      await supabase.rpc('unhide_post', { post_id: post.id })
    } else {
      await supabase.rpc('hide_post', { post_id: post.id })
    }
    loadMetrics()
    loadPosts(tab, search, 0)
    setPage(0)
  }

  function loadMore() {
    const next = page + 1
    setPage(next)
    loadPosts(tab, search, next)
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'today',  label: 'Today' },
    { key: 'week',   label: 'This week' },
    { key: 'all',    label: 'All time' },
    { key: 'hidden', label: 'Hidden' },
  ]

  return (
    <div className="px-5 py-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Posts</h1>

      <MetricsBar metrics={metrics} />

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === key ? 'white' : 'transparent',
              color: tab === key ? ACCENT : '#6b7280',
              boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <label htmlFor="post-search" className="sr-only">Search posts</label>
        <input
          id="post-search"
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search post text…"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2"
          style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
        />
      </div>

      {/* List */}
      {loading && posts.length === 0 ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">No posts found.</p>
      ) : (
        <>
          <div className="space-y-2">
            {posts.map(post => {
              const palette = dayPalette(new Date(post.date + 'T12:00:00'))
              const isHidden = post.moderation_status === 'hidden'
              return (
                <button
                  key={post.id}
                  onClick={() => setSelected(post)}
                  className="w-full text-left rounded-2xl bg-white p-4 shadow-sm flex items-start gap-3 hover:shadow-md transition-shadow"
                >
                  {/* Day color dot */}
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5" style={{ background: palette.bg }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-gray-700">
                        {post.profiles?.display_name ?? '—'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(post.date + 'T12:00:00'), 'MMM d')}
                      </span>
                      {isHidden && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">Hidden</span>
                      )}
                      {post.photo_url && (
                        <span className="text-xs text-gray-400">📷</span>
                      )}
                    </div>
                    {post.prompts?.text && (
                      <p className="text-xs text-gray-400 italic truncate mb-0.5">{post.prompts.text}</p>
                    )}
                    {post.text && (
                      <p className="text-sm text-gray-700 line-clamp-2 leading-snug">{post.text}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}

      {selected && (
        <PostActionSheet
          post={selected}
          onClose={() => setSelected(null)}
          onHideToggle={handleHideToggle}
        />
      )}
    </div>
  )
}
