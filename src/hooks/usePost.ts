import { useEffect, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { supabase } from '../lib/supabase'

export interface Post {
  id: string
  userId: string
  promptId: string
  date: string
  text: string | null
  photoUrl: string | null
  createdAt: string
  updatedAt: string
}

interface SubmitArgs {
  promptId: string
  text: string
  photoFile: File | null
  keepPhotoUrl?: string | null // storage path to retain if no new file selected
}

interface UsePost {
  submit: (args: SubmitArgs) => Promise<{ post: Post | null; error: string | null }>
  isSubmitting: boolean
}

interface UseTodayPost {
  post: Post | null
  isLoading: boolean
  isEditable: boolean
  setPost: (post: Post) => void
}

function rowToPost(data: Record<string, unknown>): Post {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    promptId: data.prompt_id as string,
    date: data.date as string,
    text: data.text as string | null,
    photoUrl: data.photo_url as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  }
}

/** Returns whether a post is still within the 5-minute edit window. */
export function isWithinEditWindow(post: Post): boolean {
  const updatedAt = new Date(post.updatedAt).getTime()
  return Date.now() - updatedAt < 5 * 60 * 1000
}

/** Checks for an existing post for today and tracks whether it's editable. */
export function useTodayPost(): UseTodayPost {
  const [post, setPost] = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditable, setIsEditable] = useState(false)

  useEffect(() => {
    let cancelled = false
    const today = new Date().toISOString().slice(0, 10)

    async function load() {
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('date', today)
        .maybeSingle()

      if (cancelled) return
      if (data) {
        const p = rowToPost(data as Record<string, unknown>)
        setPost(p)
        setIsEditable(isWithinEditWindow(p))
      }
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  // Re-evaluate editability every 10s so the edit button disappears at exactly 5min
  useEffect(() => {
    if (!post) return
    const timer = setInterval(() => {
      setIsEditable(isWithinEditWindow(post))
    }, 10_000)
    return () => clearInterval(timer)
  }, [post])

  function handleSetPost(p: Post) {
    setPost(p)
    setIsEditable(isWithinEditWindow(p))
  }

  return { post, isLoading, isEditable, setPost: handleSetPost }
}

export function usePost(): UsePost {
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit({ promptId, text, photoFile, keepPhotoUrl }: SubmitArgs): Promise<{ post: Post | null; error: string | null }> {
    setIsSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { post: null, error: 'Not signed in' }

      let photoUrl: string | null = keepPhotoUrl ?? null

      if (photoFile) {
        const compressed = await imageCompression(photoFile, {
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          fileType: 'image/webp',
        })
        const path = `${user.id}/${Date.now()}.webp`
        const { error: uploadError } = await supabase.storage
          .from('post-photos')
          .upload(path, compressed, { contentType: 'image/webp', upsert: false })

        if (uploadError) return { post: null, error: uploadError.message }
        photoUrl = path
      }

      const today = new Date().toISOString().slice(0, 10)
      const { data, error: insertError } = await supabase
        .from('posts')
        .upsert({
          user_id: user.id,
          prompt_id: promptId,
          date: today,
          text: text || null,
          photo_url: photoUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,date' })
        .select()
        .single()

      if (insertError) return { post: null, error: insertError.message }

      return { post: rowToPost(data as Record<string, unknown>), error: null }
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting }
}
