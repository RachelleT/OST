import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { dayPalette } from '../lib/palette'
import { useAuth } from '../hooks/useAuth'
import { useTodayPrompt } from '../hooks/useTodayPrompt'
import { useTodayPost } from '../hooks/usePost'
import type { Post } from '../hooks/usePost'
import { useStreak } from '../hooks/useStreak'
import { supabase } from '../lib/supabase'
import { noteForToday } from '../lib/notes'
import type { Note } from '../lib/notes'
import DayBackground from '../components/DayBackground'
import StreakPill from '../components/StreakPill'
import PostComposer from '../components/PostComposer'
import PostCard from '../components/PostCard'
import WarmNote from '../components/WarmNote'
import NotificationPrompt from '../components/NotificationPrompt'
import { reminderLabel } from '../lib/reminderTime'

const today = new Date()
const palette = dayPalette(today)

export default function Today() {
  const { user } = useAuth()
  const { data: prompt, isLoading: promptLoading, error: promptError } = useTodayPrompt()
  const { post: existingPost, isLoading: postLoading, isEditable, setPost } = useTodayPost()
  const [editing, setEditing] = useState(false)
  const [streakKey, setStreakKey] = useState(0)
  const { current: currentStreak } = useStreak(streakKey)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [profileReminderTime, setProfileReminderTime] = useState<string | null>(null)

  // Derive the active post: prefer the freshly submitted one
  const [submittedPost, setSubmittedPost] = useState<Post | null>(null)
  const [graceUsed, setGraceUsed] = useState(false)
  const [isFirstPost, setIsFirstPost] = useState(false)
  const [emptyNote, setEmptyNote] = useState<Note | null>(null)
  const [completedNote, setCompletedNote] = useState<Note | null>(null)
  const activePost = submittedPost ?? existingPost

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('display_name, reminder_time')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name as string)
          setProfileReminderTime(data.reminder_time as string | null)
        }
      })
  }, [user])

  // Fetch warm notes asynchronously — don't block the rest of the screen
  useEffect(() => {
    if (!user) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    noteForToday(user.id, tz, 'empty_state').then(n => setEmptyNote(n))
    noteForToday(user.id, tz, 'completed_state').then(n => setCompletedNote(n))
  }, [user])

  // Check total post count so we know if the next submit will be the first ever
  useEffect(() => {
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => { if ((count ?? 0) === 0) setIsFirstPost(true) })
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--day-bg', palette.bg)
    root.style.setProperty('--day-surface', palette.surface)
    root.style.setProperty('--day-accent', palette.accent)
    root.style.setProperty('--day-text-on-bg', palette.textOnBg)
    return () => {
      root.style.removeProperty('--day-bg')
      root.style.removeProperty('--day-surface')
      root.style.removeProperty('--day-accent')
      root.style.removeProperty('--day-text-on-bg')
    }
  }, [])

  function handleSubmitted(post: Post, grace: boolean) {
    setSubmittedPost(post)
    setGraceUsed(grace)
    setPost(post)
    setEditing(false)
    setStreakKey(k => k + 1)
  }

  const isLoading = promptLoading || postLoading
  const showComposer = !activePost || editing

  return (
    <div className="flex-1 flex flex-col overflow-y-auto" style={{ background: '#FAF5EC' }}>

      {/* Colored section — content height only */}
      <div className="relative overflow-hidden" style={{ background: palette.bg }}>
        <DayBackground palette={palette} />

        <div className="relative z-10 px-5 pt-12 pb-10">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-base font-semibold" style={{ color: palette.textOnBg }}>
                Hey, {displayName ?? ''} ✨
              </p>
              <p className="text-xs mt-0.5" style={{ color: palette.textOnBg, opacity: 0.55 }}>
                {format(today, 'EEEE, MMMM d')}
              </p>
            </div>
            <StreakPill streak={currentStreak} />
          </div>

          {/* Prompt */}
          <div className="mb-8">
            {isLoading ? (
              <div className="space-y-3" aria-busy="true" aria-label="Loading">
                <div className="h-7 rounded-full opacity-30 animate-pulse" style={{ background: palette.accent, width: '80%' }} />
                <div className="h-7 rounded-full opacity-30 animate-pulse" style={{ background: palette.accent, width: '60%' }} />
              </div>
            ) : promptError ? (
              <p className="text-sm" style={{ color: palette.textOnBg }}>
                Couldn't load today's prompt. Please refresh.
              </p>
            ) : (
              <h1
                className="font-medium"
                style={{ color: palette.textOnBg, fontSize: 26, letterSpacing: '-0.5px', lineHeight: 1.2 }}
              >
                {prompt?.promptText}
              </h1>
            )}
          </div>

          {/* Composer or completed state */}
          {!isLoading && prompt && (
            <>
              {showComposer ? (
                <>
                  <PostComposer
                    promptId={prompt.promptId}
                    palette={palette}
                    onSubmitted={handleSubmitted}
                    initialText={editing ? (activePost?.text ?? '') : ''}
                    initialPhotoStoragePath={editing ? (activePost?.photoUrl ?? null) : null}
                  />
                  {emptyNote && (
                    <div className="mt-4">
                      <WarmNote note={emptyNote} pool="empty_state" />
                    </div>
                  )}
                </>
              ) : activePost ? (
                activePost.moderationStatus === 'hidden' ? (
                  <div
                    className="rounded-3xl p-4 text-sm"
                    style={{ background: 'rgba(255,255,255,0.55)', color: palette.textOnBg, opacity: 0.7 }}
                  >
                    This post has been hidden by a moderator. Contact support if you think this is a mistake.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <PostCard
                      post={activePost}
                      palette={palette}
                      isEditable={isEditable}
                      onEdit={() => setEditing(true)}
                      graceUsed={graceUsed}
                      currentStreak={currentStreak}
                      reminderLabel={reminderLabel(profileReminderTime)}
                      warmNote={completedNote}
                    />
                    <NotificationPrompt palette={palette} isFirstPost={isFirstPost} />
                  </div>
                )
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Neutral space below colored section */}
      <div className="py-8 text-center">
        <p
          className="text-xs font-medium"
          style={{ color: '#04342C', opacity: 0.3 }}
        >
          one small thing, every day ✦
        </p>
      </div>
    </div>
  )
}
