import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calculateStreaks } from '../lib/streak'

interface StreakState {
  current: number
  longest: number
  isLoading: boolean
}

export function useStreak(refreshKey?: number) {
  const [state, setState] = useState<StreakState>({ current: 0, longest: 0, isLoading: true })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('posts')
        .select('date')
        .order('date', { ascending: false })

      if (cancelled) return

      const dates = (data ?? []).map((r: { date: string }) => r.date)
      const { current, longest } = calculateStreaks(dates)
      setState({ current, longest, isLoading: false })

      // Persist to profile so other surfaces (history) can read it cheaply
      await supabase
        .from('profiles')
        .update({ current_streak: current, longest_streak: longest })
        .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    }

    load()
    return () => { cancelled = true }
  }, [refreshKey])

  return state
}
