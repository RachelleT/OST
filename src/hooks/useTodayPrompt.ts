import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTimezone } from '../lib/ProfileContext'

interface TodayPrompt {
  promptId: string
  promptText: string
  assignmentId: string
}

interface State {
  data: TodayPrompt | null
  isLoading: boolean
  error: string | null
}

export function useTodayPrompt() {
  const timezone = useTimezone()
  const [state, setState] = useState<State>({ data: null, isLoading: true, error: null })

  useEffect(() => {
    let cancelled = false

    async function load() {
      // The RPC now reads timezone from the user's profile server-side
      const { data: assignment, error: assignErr } = await supabase.rpc('assign_prompt_for_today')
      if (cancelled) return
      if (assignErr) {
        setState({ data: null, isLoading: false, error: assignErr.message })
        return
      }

      const { data: prompt, error: promptErr } = await supabase
        .from('prompts')
        .select('id, text')
        .eq('id', assignment.prompt_id)
        .single()
      if (cancelled) return
      if (promptErr) {
        setState({ data: null, isLoading: false, error: promptErr.message })
        return
      }

      setState({
        data: { promptId: prompt.id as string, promptText: prompt.text as string, assignmentId: assignment.id as string },
        isLoading: false,
        error: null,
      })
    }

    load()
    return () => { cancelled = true }
  // Re-run if timezone changes (profile loaded after mount)
  }, [timezone])

  return state
}
