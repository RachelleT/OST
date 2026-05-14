import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { dayPalette } from '../lib/palette'
import { useAuth } from '../hooks/useAuth'
import { useTodayPrompt } from '../hooks/useTodayPrompt'
import { useTodayPost } from '../hooks/usePost'
import type { Post } from '../hooks/usePost'
import { useStreak } from '../hooks/useStreak'
import { supabase } from '../lib/supabase'
import DayBackground from '../components/DayBackground'
import StreakPill from '../components/StreakPill'
import PostComposer from '../components/PostComposer'
import PostCard from '../components/PostCard'

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

  // Derive the active post: prefer the freshly submitted one
  const [submittedPost, setSubmittedPost] = useState<Post | null>(null)
  const activePost = submittedPost ?? existingPost

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setDisplayName(data.display_name as string) })
  }, [user])

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

  function handleSubmitted(post: Post) {
    setSubmittedPost(post)
    setPost(post)
    setEditing(false)
    setStreakKey(k => k + 1) // trigger streak recalculation
  }

  const isLoading = promptLoading || postLoading
  const showComposer = !activePost || editing

  return (
    <div
      className="relative min-h-full flex flex-col overflow-hidden"
      style={{ background: palette.bg }}
    >
      <DayBackground palette={palette} />

      <div className="relative z-10 flex flex-col min-h-full px-5 pt-12 pb-8">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium" style={{ color: palette.textOnBg }}>
            {format(today, 'EEE, MMM d')}
          </p>
          <StreakPill streak={currentStreak} />
        </div>

        {/* Greeting */}
        <p className="text-xs mb-6" style={{ color: palette.textOnBg, opacity: 0.75 }}>
          Hey {displayName ?? ''}  👋
        </p>

        {/* Prompt */}
        <div className="flex-1 flex flex-col justify-center">
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

        {/* Bottom section: composer or completed state */}
        {!isLoading && prompt && (
          <div className="mt-8">
            {showComposer ? (
              <PostComposer
                promptId={prompt.promptId}
                palette={palette}
                onSubmitted={handleSubmitted}
                initialText={editing ? (activePost?.text ?? '') : ''}
                initialPhotoStoragePath={editing ? (activePost?.photoUrl ?? null) : null}
              />
            ) : activePost ? (
              <PostCard
                post={activePost}
                palette={palette}
                isEditable={isEditable}
                onEdit={() => setEditing(true)}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
