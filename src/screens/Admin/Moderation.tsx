import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'

interface QueueItem {
  queue_id: string
  post_id: string
  reason: string
  categories: string[] | null
  queued_at: string
  reviewed_at: string | null
  decision: string | null
  post_text: string | null
  photo_url: string | null
  post_date: string
  author_name: string
}

type Tab = 'needs_review' | 'wellbeing' | 'history'

const ACCENT = '#04342C'

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  hate:     { bg: '#FEE2E2', text: '#991B1B' },
  sexual:   { bg: '#FDE68A', text: '#92400E' },
  violence: { bg: '#FFEDD5', text: '#9A3412' },
}

function PhotoThumb({ storagePath }: { storagePath: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.storage
      .from('post-photos')
      .createSignedUrl(storagePath, 60 * 60)
      .then(({ data }) => {
        if (!cancelled && data) setSrc(data.signedUrl)
      })
    return () => { cancelled = true }
  }, [storagePath])

  if (!src) return <div className="w-16 h-16 rounded-lg bg-gray-100 animate-pulse shrink-0" />
  return (
    <img
      src={src}
      alt=""
      className="w-16 h-16 rounded-lg object-cover shrink-0"
    />
  )
}

function QueueCard({
  item,
  showActions,
  onAction,
}: {
  item: QueueItem
  showActions: boolean
  onAction: (item: QueueItem, action: 'approve' | 'ignore' | 'hide') => void
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-semibold text-gray-500">
              {item.author_name}
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">
              {format(parseISO(item.post_date), 'MMM d, yyyy')}
            </span>
          </div>

          {item.categories && item.categories.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-2">
              {item.categories.map(cat => {
                const color = CATEGORY_COLORS[cat] ?? { bg: '#F3F4F6', text: '#374151' }
                return (
                  <span
                    key={cat}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                    style={{ background: color.bg, color: color.text }}
                  >
                    {cat}
                  </span>
                )
              })}
            </div>
          )}

          {item.post_text && (
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
              {item.post_text}
            </p>
          )}
        </div>

        {item.photo_url && <PhotoThumb storagePath={item.photo_url} />}
      </div>

      {/* History decision badge */}
      {item.decision && (
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
            style={{
              background: item.decision === 'hide'   ? '#FEE2E2'
                        : item.decision === 'approve' ? '#D1FAE5'
                        : '#F3F4F6',
              color:      item.decision === 'hide'   ? '#991B1B'
                        : item.decision === 'approve' ? '#065F46'
                        : '#374151',
            }}
          >
            {item.decision === 'approve' ? 'Approved'
           : item.decision === 'ignore'  ? 'False positive'
           : 'Hidden'}
          </span>
          {item.reviewed_at && (
            <span className="text-[10px] text-gray-400">
              {format(parseISO(item.reviewed_at), 'MMM d')}
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      {showActions && (
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <button
            onClick={() => onAction(item, 'approve')}
            className="flex-1 rounded-lg py-1.5 text-xs font-medium text-white"
            style={{ background: ACCENT }}
          >
            Approve
          </button>
          <button
            onClick={() => onAction(item, 'ignore')}
            className="flex-1 rounded-lg py-1.5 text-xs font-medium border border-gray-200 text-gray-600"
          >
            False positive
          </button>
          <button
            onClick={() => onAction(item, 'hide')}
            className="flex-1 rounded-lg py-1.5 text-xs font-medium border"
            style={{ borderColor: '#fca5a5', color: '#dc2626' }}
          >
            Hide
          </button>
        </div>
      )}
    </div>
  )
}

export default function AdminModeration() {
  const [tab, setTab] = useState<Tab>('needs_review')
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: rpcErr } = await supabase.rpc('get_moderation_queue', { p_filter: tab })
    if (rpcErr) { setError(rpcErr.message); setLoading(false); return }
    setItems((data as QueueItem[]) ?? [])
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])

  async function handleAction(item: QueueItem, action: 'approve' | 'ignore' | 'hide') {
    setActing(item.queue_id)
    setError('')
    let rpcErr: { message: string } | null = null

    if (action === 'approve') {
      const { error: e } = await supabase.rpc('approve_moderation', { p_queue_id: item.queue_id })
      rpcErr = e
    } else if (action === 'ignore') {
      const { error: e } = await supabase.rpc('ignore_moderation', { p_queue_id: item.queue_id })
      rpcErr = e
    } else {
      const { error: e } = await supabase.rpc('hide_from_moderation', { p_queue_id: item.queue_id })
      rpcErr = e
    }

    setActing(null)
    if (rpcErr) { setError(rpcErr.message); return }
    setItems(prev => prev.filter(i => i.queue_id !== item.queue_id))
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'needs_review', label: 'Needs review' },
    { id: 'wellbeing',    label: 'Wellbeing' },
    { id: 'history',      label: 'History' },
  ]

  return (
    <div className="px-5 py-8 w-full max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Moderation</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === t.id ? 'white' : 'transparent',
              color: tab === t.id ? ACCENT : '#6b7280',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Wellbeing disclaimer */}
      {tab === 'wellbeing' && (
        <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-800 leading-relaxed">
            These posts contain language that may indicate the author is going through something hard. Use your judgment. If you reach out, do so privately and with care. We're not licensed mental health professionals.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 mb-4">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">
          {tab === 'needs_review' ? 'Nothing to review — all clear.' :
           tab === 'wellbeing'    ? 'No wellbeing signals detected.' :
                                    'No review history yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.queue_id}
              style={{ opacity: acting === item.queue_id ? 0.5 : 1, pointerEvents: acting === item.queue_id ? 'none' : 'auto' }}
            >
              <QueueCard
                item={item}
                showActions={tab === 'needs_review'}
                onAction={handleAction}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
