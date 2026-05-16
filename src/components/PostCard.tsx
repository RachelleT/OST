import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { Post } from '../hooks/usePost'
import type { Palette } from '../lib/palette'
import { MILESTONES } from './StreakPill'
import WarmNote from './WarmNote'
import type { Note } from '../lib/notes'

const MILESTONE_ACK_PREFIX = 'milestone_acked_'

interface Props {
  post: Post
  palette: Palette
  isEditable: boolean
  onEdit: () => void
  graceUsed?: boolean
  currentStreak?: number
  reminderLabel?: string | null
  warmNote?: Note | null
}

export default function PostCard({
  post,
  palette,
  isEditable,
  onEdit,
  graceUsed = false,
  currentStreak = 0,
  reminderLabel,
  warmNote,
}: Props) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null)
  const [milestoneVisible, setMilestoneVisible] = useState(false)

  useEffect(() => {
    if (!post.photoUrl) return
    let cancelled = false
    supabase.storage
      .from('post-photos')
      .createSignedUrl(post.photoUrl, 60 * 60)
      .then(({ data }) => {
        if (!cancelled && data) setPhotoSrc(data.signedUrl)
      })
    return () => { cancelled = true }
  }, [post.photoUrl])

  // Show milestone banner once per milestone level
  useEffect(() => {
    if (!MILESTONES.includes(currentStreak)) return
    const key = `${MILESTONE_ACK_PREFIX}${currentStreak}`
    if (!localStorage.getItem(key)) {
      setMilestoneVisible(true)
    }
  }, [currentStreak])

  function dismissMilestone() {
    localStorage.setItem(`${MILESTONE_ACK_PREFIX}${currentStreak}`, '1')
    setMilestoneVisible(false)
  }

  const graceDayName = graceUsed
    ? format(new Date(post.date + 'T12:00:00'), 'EEEE')
    : null

  return (
    <div className="space-y-3">
      {/* "Done for today" pill */}
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: '#22c55e', color: '#fff' }}
          aria-label="Done for today"
        >
          <span aria-hidden="true">✓</span> Done for today
        </span>
      </div>

      {/* Milestone acknowledgment */}
      {milestoneVisible && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{ background: palette.accent, color: palette.surface }}
        >
          <span className="text-sm font-semibold">
            🎉 {currentStreak}-day streak!
          </span>
          <button
            onClick={dismissMilestone}
            aria-label="Dismiss"
            className="text-xs opacity-70 hover:opacity-100 ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grace day notice */}
      {graceUsed && graceDayName && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl px-4 py-3 text-sm font-medium"
          style={{ background: palette.surface, color: palette.accent }}
        >
          ✦ We used your grace day for {graceDayName} — your streak is safe!
        </div>
      )}

      {/* Post content card */}
      <div className="rounded-3xl p-4 bg-white space-y-3">
        {post.text && (
          <p className="text-base text-gray-800 leading-relaxed">{post.text}</p>
        )}
        {photoSrc && (
          <img
            src={photoSrc}
            alt="Your photo"
            className="w-full rounded-2xl object-cover"
            style={{ maxHeight: 300 }}
          />
        )}
        {post.photoUrl && !photoSrc && (
          <div className="w-full h-32 rounded-2xl animate-pulse bg-gray-100" aria-label="Loading photo" />
        )}
      </div>

      {/* Edit affordance — visible only within 5-minute window */}
      {isEditable && (
        <button
          onClick={onEdit}
          className="w-full rounded-full py-3 text-sm font-medium border-2 transition-transform active:scale-95"
          style={{ borderColor: palette.accent, color: palette.accent, background: 'transparent' }}
        >
          Edit response
        </button>
      )}

      {/* Warm note — between post and see you tomorrow */}
      {warmNote && <WarmNote note={warmNote} pool="completed_state" />}

      {/* See you tomorrow */}
      <div
        className="rounded-3xl p-4 text-center"
        style={{ background: palette.surface }}
      >
        <p className="text-sm font-medium" style={{ color: palette.accent }}>
          See you tomorrow ✦
        </p>
        <p className="text-xs mt-1" style={{ color: palette.accent, opacity: 0.6 }}>
          {reminderLabel
            ? `Reminder set for ${reminderLabel}`
            : 'Turn on reminders in Settings'}
        </p>
      </div>
    </div>
  )
}
