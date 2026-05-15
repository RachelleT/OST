import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { dayPalette } from '../lib/palette'
import { calculateStreaks } from '../lib/streak'
import { weekStart, weekDays, toISODate } from '../lib/date'

interface PostRow {
  id: string
  date: string
  text: string | null
  photo_url: string | null
  prompts: { text: string }[] | null
}

function HistoryPhoto({ storagePath }: { storagePath: string }) {
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

  if (!src) return <div className="w-full h-32 rounded-xl bg-gray-100 animate-pulse mt-2" />
  return (
    <img
      src={src}
      alt=""
      className="w-full rounded-xl object-cover mt-2"
      style={{ maxHeight: 180 }}
    />
  )
}

const NEUTRAL_BG = '#F1EFE8'

export default function History() {
  const [posts, setPosts] = useState<PostRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('posts')
      .select('id, date, text, photo_url, prompts(text)')
      .order('date', { ascending: false })
      .then(({ data }) => {
        setPosts((data as unknown as PostRow[]) ?? [])
        setIsLoading(false)
      })
  }, [])

  const dates = posts.map(p => p.date)
  const { current, longest } = calculateStreaks(dates)
  const postedSet = new Set(dates)

  // Build 6-week grid ending today
  const today = new Date()
  const monday = weekStart(today)
  const weeks: Date[][] = Array.from({ length: 6 }, (_, i) => {
    const weekMonday = new Date(monday)
    weekMonday.setDate(monday.getDate() - (5 - i) * 7)
    return weekDays(weekMonday)
  })

  // Group posts by week label for the list below
  const grouped = posts.reduce<Record<string, PostRow[]>>((acc, post) => {
    const d = parseISO(post.date)
    const label = format(weekStart(d), "'Week of' MMM d")
    ;(acc[label] ??= []).push(post)
    return acc
  }, {})

  return (
    <div className="min-h-full pb-20" style={{ background: NEUTRAL_BG }}>
      <div className="px-5 pt-12 space-y-6">

        {/* Header */}
        <h1 className="text-xl font-semibold text-gray-900">History</h1>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Current streak', value: current },
            { label: 'Longest streak', value: longest },
            { label: 'Total posts', value: posts.length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl bg-white p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* 6-week heatmap */}
        <div>
          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <p key={i} className="text-center text-xs text-gray-400 font-medium">{d}</p>
            ))}
          </div>
          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map(day => {
                  const iso = toISODate(day)
                  const posted = postedSet.has(iso)
                  const p = dayPalette(day)
                  const isFuture = day > today
                  return (
                    <div
                      key={iso}
                      title={format(day, 'MMM d')}
                      className="aspect-square rounded-md"
                      style={{
                        background: isFuture
                          ? '#e5e7eb'
                          : posted
                          ? p.accent
                          : '#d1d5db',
                        opacity: isFuture ? 0.3 : 1,
                      }}
                      aria-label={`${format(day, 'MMM d')}${posted ? ', posted' : ''}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Post list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No posts yet — come back after you share your first response.
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([weekLabel, weekPosts]) => (
              <div key={weekLabel}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {weekLabel}
                </p>
                <div className="space-y-2">
                  {weekPosts.map(post => {
                    const p = dayPalette(parseISO(post.date))
                    return (
                      <div key={post.id} className="rounded-2xl bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: p.bg }}
                            aria-hidden="true"
                          />
                          <p className="text-xs font-medium text-gray-500">
                            {format(parseISO(post.date), 'EEEE, MMM d')}
                          </p>
                        </div>
                        {post.prompts?.[0]?.text && (
                          <p className="text-xs text-gray-400 italic mb-1 line-clamp-1">
                            {post.prompts[0].text}
                          </p>
                        )}
                        {post.text && (
                          <p className="text-sm text-gray-800 leading-relaxed line-clamp-3">
                            {post.text}
                          </p>
                        )}
                        {post.photo_url && (
                          <HistoryPhoto storagePath={post.photo_url} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
