import { useEffect, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { supabase } from '../lib/supabase'
import { userToday } from '../lib/date'
import { useTimezone } from '../lib/ProfileContext'

const POST_CACHE_KEY = 'ost_today_post'

function savePostCache(p: Post) {
  try { sessionStorage.setItem(POST_CACHE_KEY, JSON.stringify(p)) } catch {}
}

function loadPostCache(): Post | null {
  try {
    const raw = sessionStorage.getItem(POST_CACHE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Post
    const todayBrowser = userToday(Intl.DateTimeFormat().resolvedOptions().timeZone)
    const todayUtc = new Date().toISOString().slice(0, 10)
    return (p.date === todayBrowser || p.date === todayUtc) ? p : null
  } catch { return null }
}

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
  const cached = loadPostCache()

  const [post, setPost] = useState<Post | null>(cached)
  const [isLoading, setIsLoading] = useState(cached === null)
  const [isEditable, setIsEditable] = useState(() => cached ? isWithinEditWindow(cached) : false)

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
        savePostCache(p)
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
    savePostCache(p)
  }

  return { post, isLoading, isEditable, setPost: handleSetPost }
}

export function usePost(): UsePost {
  const timezone = useTimezone()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit({ promptId, text, photoFile, keepPhotoUrl }: SubmitArgs): Promise<{ post: Post | null; graceUsed: boolean; error: string | null }> {
    setIsSubmitting(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
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

      const today = userToday(timezone)
      const { data: savedPost, error: saveError } = await supabase
        .from('posts')
        .upsert({
          user_id:        user.id,
          prompt_id:      promptId,
          date:           today,
          text:           text || null,
          photo_url:      photoUrl,
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'user_id,date' })
        .select()
        .single()

      if (saveError) return { post: null, graceUsed: false, error: saveError.message }

      let graceUsed = false
      const { data: rpcData } = await supabase.rpc('submit_post', {
        p_prompt_id:  promptId,
        p_text:       text || '',
        p_photo_url:  photoUrl ?? '',
        p_share_anon: false,
        p_share_named: false,
      })
      const rawRpc = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as Record<string, unknown> | null
      graceUsed = (rawRpc?.grace_used as boolean) ?? false

      const post = rowToPost(savedPost as Record<string, unknown>)
      return { post, graceUsed, error: null }
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting }
}
