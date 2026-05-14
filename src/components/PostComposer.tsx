import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Palette } from '../lib/palette'
import type { Post } from '../hooks/usePost'
import { usePost } from '../hooks/usePost'
import { supabase } from '../lib/supabase'

const MAX_CHARS = 280

interface Props {
  promptId: string
  palette: Palette
  onSubmitted: (post: Post, graceUsed: boolean) => void
  initialText?: string
  initialPhotoStoragePath?: string | null // storage path of existing photo, if editing
}

export default function PostComposer({
  promptId,
  palette,
  onSubmitted,
  initialText = '',
  initialPhotoStoragePath,
}: Props) {
  const [text, setText] = useState(initialText)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  // The storage path we'll keep if the user doesn't pick a new photo
  const [keepPhotoPath, setKeepPhotoPath] = useState<string | null>(initialPhotoStoragePath ?? null)
  const [toast, setToast] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const { submit, isSubmitting } = usePost()

  // Load a signed URL for the existing photo so we can show it as a preview
  useEffect(() => {
    if (!initialPhotoStoragePath) return
    let cancelled = false
    supabase.storage
      .from('post-photos')
      .createSignedUrl(initialPhotoStoragePath, 300)
      .then(({ data }) => {
        if (!cancelled && data) setPhotoPreview(data.signedUrl)
      })
    return () => { cancelled = true }
  }, [initialPhotoStoragePath])

  const charsLeft = MAX_CHARS - text.length
  const hasPhoto = photoFile !== null || keepPhotoPath !== null
  const canSubmit = (text.trim().length > 0 || hasPhoto) && !isSubmitting

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function handlePhotoSelected(file: File | null) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo must be under 5 MB')
      return
    }
    // New file replaces the existing one
    setPhotoFile(file)
    setKeepPhotoPath(null)
    if (photoPreview && !photoPreview.startsWith('blob:') === false) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setPhotoFile(null)
    setKeepPhotoPath(null)
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    const { post, graceUsed, error } = await submit({
      promptId,
      text: text.trim(),
      photoFile,
      keepPhotoUrl: keepPhotoPath,
    })
    if (error) {
      showToast('Something went wrong. Please try again.')
      return
    }
    if (post) onSubmitted(post, graceUsed)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {toast && (
        <div
          role="alert"
          className="text-sm px-4 py-2.5 rounded-2xl font-medium"
          style={{ background: palette.accent, color: palette.surface }}
        >
          {toast}
        </div>
      )}

      <div className="rounded-3xl p-4" style={{ background: palette.surface }}>
        <label htmlFor="post-text" className="sr-only">Your response</label>
        <textarea
          id="post-text"
          value={text}
          onChange={e => {
            if (e.target.value.length <= MAX_CHARS) setText(e.target.value)
          }}
          placeholder="What's on your mind?"
          rows={4}
          className="w-full bg-transparent resize-none text-base focus:outline-none placeholder:opacity-40"
          style={{ color: palette.accent }}
          disabled={isSubmitting}
        />

        {photoPreview && (
          <div className="relative mt-2 rounded-2xl overflow-hidden" style={{ maxHeight: 200 }}>
            <img src={photoPreview} alt="Selected photo" className="w-full object-cover rounded-2xl" style={{ maxHeight: 200 }} />
            <button
              type="button"
              onClick={removePhoto}
              aria-label="Remove photo"
              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: palette.accent, color: palette.surface }}
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Attach photo from library"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-40"
              style={{ background: palette.bg }}
            >
              <span aria-hidden="true" style={{ color: palette.accent, fontSize: 16 }}>🖼</span>
            </button>
            <button
              type="button"
              aria-label="Take a photo"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isSubmitting}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-40"
              style={{ background: palette.bg }}
            >
              <span aria-hidden="true" style={{ color: palette.accent, fontSize: 16 }}>📷</span>
            </button>
          </div>
          <span
            className="text-xs font-medium tabular-nums"
            style={{ color: palette.accent, opacity: charsLeft <= 20 ? 1 : 0.45 }}
            aria-live="polite"
            aria-label={`${charsLeft} characters remaining`}
          >
            {charsLeft} / {MAX_CHARS}
          </span>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
        className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={e => handlePhotoSelected(e.target.files?.[0] ?? null)} />
      <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp"
        capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={e => handlePhotoSelected(e.target.files?.[0] ?? null)} />

      <motion.button
        type="submit"
        disabled={!canSubmit}
        whileTap={{ scale: 0.97 }}
        className="w-full rounded-full py-4 text-sm font-medium disabled:opacity-40"
        style={{ background: palette.accent, color: palette.surface }}
      >
        {isSubmitting ? 'Sharing…' : 'Share'}
      </motion.button>
    </form>
  )
}
