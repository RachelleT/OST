import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Post } from '../hooks/usePost'
import type { Palette } from '../lib/palette'

interface Props {
  post: Post
  palette: Palette
  isEditable: boolean
  onEdit: () => void
}

export default function PostCard({ post, palette, isEditable, onEdit }: Props) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!post.photoUrl) return
    let cancelled = false

    supabase.storage
      .from('post-photos')
      .createSignedUrl(post.photoUrl, 60 * 60) // 1-hour signed URL
      .then(({ data }) => {
        if (!cancelled && data) setPhotoSrc(data.signedUrl)
      })

    return () => { cancelled = true }
  }, [post.photoUrl])

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

      {/* See you tomorrow card */}
      <div
        className="rounded-3xl p-4 text-center"
        style={{ background: palette.surface }}
      >
        <p className="text-sm font-medium" style={{ color: palette.accent }}>
          See you tomorrow ✦
        </p>
        <p className="text-xs mt-1" style={{ color: palette.accent, opacity: 0.6 }}>
          Come back for a new prompt
        </p>
      </div>
    </div>
  )
}
