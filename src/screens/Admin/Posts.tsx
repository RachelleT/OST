import { useEffect, useState, useCallback } from 'react'
import { format, startOfWeek } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { dayPalette } from '../../lib/palette'
import ShareCard from '../../components/ShareCard'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

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

type FilterTab = 'today' | 'week' | 'all' | 'featurable' | 'hidden'

function eligibilityInfo(post: AdminPost): { label: string; bg: string; color: string } | null {
  if (post.moderation_status === 'hidden')  return null
  if (post.moderation_status === 'held')    return { label: 'Held',           bg: '#FEF3C7', color: '#92400E' }
  if (post.moderation_status === 'pending') return { label: 'Pending review', bg: '#F3F4F6', color: '#6B7280' }
  return { label: 'Featurable', bg: '#D1FAE5', color: '#065F46' }
}

function featureBlockReason(post: AdminPost): string | null {
  if (post.moderation_status === 'held')    return 'Post is held for moderation review'
  if (post.moderation_status === 'pending') return 'Moderation check is still running'
  return null
}

// ── Helpers ────────────────────────────────────────────────────────────────

const ACCENT = '#04342C'
const PAGE_SIZE = 50

// All 7 palettes: Sun(0) through Sat(6)
const WEEK_PALETTES = Array.from({ length: 7 }, (_, dow) => {
  const d = new Date(2024, 0, 7 + dow) // Jan 7 2024 = Sunday
  return dayPalette(d)
})

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
    { label: 'Total users',     value: metrics?.totalUsers    ?? '—' },
    { label: 'Posts today',     value: metrics?.postsToday    ?? '—' },
    { label: 'Posts this week', value: metrics?.postsThisWeek ?? '—' },
    { label: 'Hidden',          value: metrics?.hiddenPosts   ?? '—' },
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
  const [featuredMode, setFeaturedMode] = useState<string | null | undefined>(undefined)
  const [featureWorking, setFeatureWorking] = useState(false)
  const [showModePicker, setShowModePicker] = useState(false)
  const [pendingMode, setPendingMode] = useState<'anonymous' | 'with_name'>('anonymous')
  const [shareCardView, setShareCardView] = useState(false)
  const [cardPalette, setCardPalette] = useState(() => dayPalette(new Date(post.date + 'T12:00:00')))
  const [cardShowName, setCardShowName] = useState(post.share_with_name)
  const [downloading, setDownloading] = useState(false)
  const [copyDone, setCopyDone] = useState(false)

  useBodyScrollLock()
  const isHidden = post.moderation_status === 'hidden'
  const palette = dayPalette(new Date(post.date + 'T12:00:00'))
  const isFeatured = featuredMode !== undefined && featuredMode !== null

  useEffect(() => {
    if (post.photo_url) {
      supabase.storage
        .from('post-photos')
        .createSignedUrl(post.photo_url, 3600)
        .then(({ data }) => { if (data) setPhotoSrc(data.signedUrl) })
    }
    supabase
      .from('featured_posts')
      .select('display_mode')
      .eq('post_id', post.id)
      .is('unfeatured_at', null)
      .maybeSingle()
      .then(({ data }) => { setFeaturedMode(data?.display_mode ?? null) })
  }, [post.id, post.photo_url])

  async function handleHideToggle() {
    setWorking(true)
    await onHideToggle(post)
    setWorking(false)
    onClose()
  }

  async function handleFeature(mode: 'anonymous' | 'with_name') {
    setFeatureWorking(true)
    const { error } = await supabase.rpc('feature_post', { p_post_id: post.id, p_display_mode: mode })
    setFeatureWorking(false)
    if (!error) { setFeaturedMode(mode); setShowModePicker(false) }
  }

  async function handleUnfeature() {
    setFeatureWorking(true)
    await supabase.rpc('unfeature_post', { p_post_id: post.id })
    setFeatureWorking(false)
    setFeaturedMode(null)
  }

  function handleFeatureClick() {
    setShowModePicker(true)
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${post.id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement('textarea')
      el.value = url
      el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  async function downloadCard() {
    setDownloading(true)
    try {
      const { toPng } = await import('html-to-image')
      const node = document.getElementById('ost-share-card')
      if (!node) return
      const dataUrl = await toPng(node as HTMLElement, { pixelRatio: 3, cacheBust: true })
      const link = document.createElement('a')
      link.download = `one-small-thing-${post.id.slice(0, 8)}.png`
      link.href = dataUrl
      link.click()
    } catch (e) {
      console.error('Share card generation failed', e)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ background: palette.bg }}>
          {shareCardView ? (
            <button
              onClick={() => setShareCardView(false)}
              className="text-xs font-medium"
              style={{ color: palette.textOnBg, opacity: 0.8 }}
            >
              ← Back
            </button>
          ) : (
            <div>
              <p className="text-xs font-semibold" style={{ color: palette.textOnBg }}>
                {post.profiles?.display_name ?? 'Unknown'}
              </p>
              <p className="text-xs opacity-70" style={{ color: palette.textOnBg }}>
                {format(new Date(post.date + 'T12:00:00'), 'EEEE, MMMM d')}
              </p>
            </div>
          )}
          <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100" style={{ color: palette.textOnBg }}>
            ✕
          </button>
        </div>

        {shareCardView ? (
          /* ── Share card view ─────────────────────────────────────── */
          <>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">

              {/* Palette swatches */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Color</p>
                <div className="flex gap-2 flex-wrap">
                  {WEEK_PALETTES.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setCardPalette(p)}
                      className="w-8 h-8 rounded-full border-2 transition-all"
                      style={{
                        background: p.bg,
                        borderColor: cardPalette.dayName === p.dayName ? '#1a1a1a' : 'transparent',
                        transform: cardPalette.dayName === p.dayName ? 'scale(1.2)' : 'scale(1)',
                      }}
                      title={p.dayName}
                    />
                  ))}
                </div>
              </div>

              {/* Name toggle */}
              {post.profiles?.display_name && (
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    className="relative w-10 h-6 rounded-full transition-colors"
                    style={{ background: cardShowName ? ACCENT : '#d1d5db' }}
                  >
                    <div
                      className="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm"
                      style={{ transform: cardShowName ? 'translateX(20px)' : 'translateX(4px)' }}
                    />
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={cardShowName}
                      onChange={e => setCardShowName(e.target.checked)}
                    />
                  </div>
                  <span className="text-sm text-gray-700">Show name ({post.profiles.display_name})</span>
                </label>
              )}

              {/* Card preview — scaled to 80% to fit */}
              <div className="flex justify-center" style={{ height: 292, overflow: 'hidden' }}>
                <div style={{ transform: 'scale(0.81)', transformOrigin: 'top center', flexShrink: 0 }}>
                  <ShareCard
                    palette={cardPalette}
                    promptText={post.prompts?.text ?? ''}
                    postText={post.text ?? ''}
                    authorName={post.profiles?.display_name ?? null}
                    showName={cardShowName}
                  />
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 shrink-0">
              <button
                onClick={downloadCard}
                disabled={downloading}
                className="w-full rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                {downloading ? 'Generating…' : 'Download PNG (1080×1080)'}
              </button>
            </div>
          </>
        ) : (
          /* ── Normal post view ────────────────────────────────────── */
          <>
            <div className="overflow-y-auto p-5 space-y-4 flex-1">
              {post.prompts?.text && (
                <p className="text-xs text-gray-400 italic">{post.prompts.text}</p>
              )}
              {post.text && (
                <p className="text-sm text-gray-800 leading-relaxed">{post.text}</p>
              )}
              {post.photo_url && (
                photoSrc
                  ? <img src={photoSrc} alt="" className="w-full rounded-2xl object-cover" style={{ maxHeight: 240 }} />
                  : <div className="w-full h-32 rounded-2xl bg-gray-100 animate-pulse" />
              )}

              <div className="flex flex-wrap gap-2">
                {isHidden && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">Hidden</span>
                )}
                {isFeatured && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">
                    ⭐ Featured · {featuredMode === 'with_name' ? 'with name' : 'anonymous'}
                  </span>
                )}
              </div>

              {/* Inline display mode picker */}
              {showModePicker && (
                <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
                  <p className="text-xs font-medium text-gray-600 mb-3">Display as…</p>
                  {(['anonymous', 'with_name'] as const).map(mode => {
                    const nameBlocked = mode === 'with_name' && !post.share_with_name
                    return (
                      <button
                        key={mode}
                        onClick={() => !nameBlocked && setPendingMode(mode)}
                        disabled={nameBlocked}
                        className="w-full text-left rounded-xl px-4 py-2.5 text-sm border-2 transition-colors disabled:opacity-40"
                        style={{
                          borderColor: pendingMode === mode ? ACCENT : 'transparent',
                          background: pendingMode === mode ? '#E1F5EE' : 'white',
                          color: pendingMode === mode ? ACCENT : '#374151',
                        }}
                      >
                        {mode === 'anonymous'
                          ? '🕵️ Anonymous'
                          : `👤 ${post.profiles?.display_name ?? 'With name'}${nameBlocked ? ' (user hasn\'t opted in)' : ''}`}
                      </button>
                    )
                  })}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setShowModePicker(false)}
                      className="flex-1 rounded-xl py-2 text-sm font-medium border border-gray-200 text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleFeature(pendingMode)}
                      disabled={featureWorking}
                      className="flex-1 rounded-xl py-2 text-sm font-medium text-white disabled:opacity-40"
                      style={{ background: ACCENT }}
                    >
                      {featureWorking ? '…' : 'Feature'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 pt-0 space-y-2 border-t border-gray-100 shrink-0">
              {/* Hide / unhide */}
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

              {/* Feature / unfeature */}
              {featuredMode === undefined ? (
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              ) : isFeatured ? (
                <div className="flex gap-2">
                  <button
                    onClick={copyLink}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-gray-200 text-gray-600"
                  >
                    {copyDone ? '✓ Copied' : 'Copy link'}
                  </button>
                  <button
                    onClick={handleUnfeature}
                    disabled={featureWorking}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium border disabled:opacity-40"
                    style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                  >
                    {featureWorking ? '…' : 'Unfeature'}
                  </button>
                </div>
              ) : (() => {
                const blockReason = featureBlockReason(post)
                return (
                  <div>
                    <button
                      onClick={handleFeatureClick}
                      disabled={featureWorking || showModePicker || blockReason !== null}
                      className="w-full rounded-xl py-2.5 text-sm font-medium border disabled:opacity-40"
                      style={{ borderColor: ACCENT, color: ACCENT }}
                    >
                      {featureWorking ? '…' : 'Feature on website'}
                    </button>
                    {blockReason && (
                      <p className="text-xs text-gray-400 text-center mt-1">{blockReason}</p>
                    )}
                  </div>
                )
              })()}

              {/* Save as image */}
              <button
                onClick={() => setShareCardView(true)}
                className="w-full rounded-xl py-2.5 text-sm font-medium border border-gray-200 text-gray-600"
              >
                Save as image
              </button>
            </div>
          </>
        )}
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
      totalUsers:   users    ?? 0,
      postsToday:   postsToday   ?? 0,
      postsThisWeek: postsWeek ?? 0,
      hiddenPosts:  hidden   ?? 0,
    })
  }, [])

  const loadPosts = useCallback(async (currentTab: FilterTab, searchText: string, pageNum: number) => {
    setLoading(true)
    let q = supabase
      .from('posts')
      .select('id, date, text, photo_url, moderation_status, share_anonymous, share_with_name, created_at, profiles(display_name), prompts(text)')
      .order('date',       { ascending: false })
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (currentTab === 'today')      q = q.eq('date', todayUTC())
    if (currentTab === 'week')       q = q.gte('date', weekStartUTC())
    if (currentTab === 'hidden')     q = q.eq('moderation_status', 'hidden')
    if (currentTab === 'featurable') q = q.eq('moderation_status', 'approved')
    if (searchText.trim())       q = q.ilike('text', `%${searchText.trim()}%`)

    const { data } = await q
    const rows = (data as unknown as AdminPost[]) ?? []

    if (pageNum === 0) setPosts(rows)
    else setPosts(prev => [...prev, ...rows])
    setHasMore(rows.length === PAGE_SIZE)
    setLoading(false)
  }, [])

  useEffect(() => { loadMetrics() }, [loadMetrics])

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
    { key: 'today',      label: 'Today' },
    { key: 'week',       label: 'This week' },
    { key: 'all',        label: 'All time' },
    { key: 'featurable', label: 'Featurable' },
    { key: 'hidden',     label: 'Hidden' },
  ]

  return (
    <div className="px-5 py-8 w-full max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Posts</h1>

      <MetricsBar metrics={metrics} />

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-full overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
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
                      {!isHidden && (() => {
                        const e = eligibilityInfo(post)
                        return e ? (
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: e.bg, color: e.color }}
                          >
                            {e.label}
                          </span>
                        ) : null
                      })()}
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
