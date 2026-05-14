import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
  const [state, setState] = useState<State>({ data: null, isLoading: true, error: null })

  useEffect(() => {
    let cancelled = false

    async function load() {
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
        data: { promptId: prompt.id, promptText: prompt.text, assignmentId: assignment.id },
        isLoading: false,
        error: null,
      })
    }

    load()
    return () => { cancelled = true }
  }, [])

  return state
}
