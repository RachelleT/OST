import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { dayPalette } from '../lib/palette'
import { calculateStreaks } from '../lib/streak'
import { weekStart, weekDays, toISODate } from '../lib/date'
import { useProfile } from '../lib/ProfileContext'
import { useAuth } from '../hooks/useAuth'
import SharingToggles from '../components/SharingToggles'

interface PostRow {
  id: string
  date: string
  text: string | null
  photo_url: string | null
  moderation_status: string
  share_anonymous: boolean
  share_with_name: boolean
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
  const profile = useProfile()
  const { user } = useAuth()
  const [posts, setPosts] = useState<PostRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function updateShareNamed(postId: string, value: boolean) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, share_with_name: value } : p))
    await supabase.from('posts').update({ share_with_name: value }).eq('id', postId)
  }

  useEffect(() => {
    if (!user) return
    supabase
      .from('posts')
      .select('id, date, text, photo_url, moderation_status, share_anonymous, share_with_name, prompts(text)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .then(({ data }) => {
        setPosts((data as unknown as PostRow[]) ?? [])
        setIsLoading(false)
      })
  }, [user])

  const dates = posts.map(p => p.date)
  const { current, longest } = calculateStreaks(dates)
  const postedSet = new Set(dates)

  // Grid grows from join week up to a max of 5 rows. After 5 weeks the oldest
  // row is dropped and a new one added at the bottom each Sunday.
  const today = new Date()
  const todayISO = toISODate(today)
  const joinedISO = user ? toISODate(new Date(user.created_at)) : todayISO
  const joinWeekSunday = weekStart(new Date(joinedISO))
  const currentWeekSunday = weekStart(today)
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const totalWeeks = Math.round((currentWeekSunday.getTime() - joinWeekSunday.getTime()) / msPerWeek) + 1
  const displayWeeks = Math.min(totalWeeks, 5)
  const startSunday = totalWeeks <= 5
    ? joinWeekSunday
    : new Date(currentWeekSunday.getTime() - (displayWeeks - 1) * msPerWeek)
  const weeks: Date[][] = Array.from({ length: displayWeeks }, (_, i) => {
    const s = new Date(startSunday)
    s.setDate(startSunday.getDate() + i * 7)
    return weekDays(s)
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
            {['S','M','T','W','T','F','S'].map((d, i) => (
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
                  const isFuture = iso > todayISO
                  const isToday = iso === todayISO
                  const isMissed = !isFuture && !isToday && !posted && iso >= joinedISO
                  return (
                    <div
                      key={iso}
                      title={format(day, 'MMM d')}
                      className="aspect-square rounded-md flex items-center justify-center"
                      style={{
                        background: isFuture
                          ? '#e5e7eb'
                          : posted
                          ? p.accent
                          : isToday
                          ? p.light
                          : '#d1d5db',
                        boxShadow: isToday ? `inset 0 0 0 2px ${p.accent}` : undefined,
                      }}
                      aria-label={`${format(day, 'MMM d')}${posted ? ', posted' : isMissed ? ', missed' : ''}`}
                    >
                      {isMissed && (
                        <span className="text-[9px] font-bold leading-none" style={{ color: '#9ca3af' }}>✕</span>
                      )}
                    </div>
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
                    const isHidden = post.moderation_status === 'hidden'
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
                        {isHidden ? (
                          <p className="text-sm text-gray-400 italic">
                            This post has been hidden by a moderator. Contact support if you think this is a mistake.
                          </p>
                        ) : (
                          <>
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
                            <div className="mt-3">
                              <SharingToggles
                                shareNamed={post.share_with_name}
                                displayName={profile?.displayName ?? ''}
                                onChangeNamed={v => updateShareNamed(post.id, v)}
                                accent={p.accent}
                                bg="#F3F4F6"
                              />
                            </div>
                          </>
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
