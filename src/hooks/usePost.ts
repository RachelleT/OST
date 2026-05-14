import { useEffect, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { supabase } from '../lib/supabase'
import { userToday } from '../lib/date'
import { useTimezone } from '../lib/ProfileContext'

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
  keepPhotoUrl?: string | null
}

interface UsePost {
  submit: (args: SubmitArgs) => Promise<{ post: Post | null; graceUsed: boolean; error: string | null }>
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

export function isWithinEditWindow(post: Post): boolean {
  const updatedAt = new Date(post.updatedAt).getTime()
  return Date.now() - updatedAt < 5 * 60 * 1000
}

export function useTodayPost(): UseTodayPost {
  const timezone = useTimezone()
  const [post, setPost] = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditable, setIsEditable] = useState(false)

  useEffect(() => {
    let cancelled = false
    const today = userToday(timezone)

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
  }, [timezone])

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

  async function submit({ promptId, text, photoFile, keepPhotoUrl }: SubmitArgs): Promise<{ post: Post | null; graceUsed: boolean; error: string | null }> {
    setIsSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { post: null, graceUsed: false, error: 'Not signed in' }

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

        if (uploadError) return { post: null, graceUsed: false, error: uploadError.message }
        photoUrl = path
      }

      const { data, error: rpcError } = await supabase.rpc('submit_post', {
        p_prompt_id:  promptId,
        p_text:       text || '',
        p_photo_url:  photoUrl ?? '',
        p_share_anon: false,
        p_share_named: false,
      })

      if (rpcError) return { post: null, graceUsed: false, error: rpcError.message }

      const result = data as Record<string, unknown>
      const post = rowToPost(result)
      const graceUsed = result.grace_used as boolean

      return { post, graceUsed, error: null }
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting }
}
