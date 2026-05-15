import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  isLoading: boolean
}

interface UseAuth extends AuthState {
  signIn: (email: string) => Promise<{ error: string | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuth {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true })

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on startup (after processing any
    // magic-link code in the URL), so we don't need a separate getSession() call
    // that would race against the code exchange and resolve null too early.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null
      setState({ user, isLoading: false })

      if (user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // Fire-and-forget: restore admin for bootstrap emails on every sign-in
        void supabase.rpc('ensure_bootstrap_admin')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }

  async function verifyOtp(email: string, token: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    return { error: error?.message ?? null }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  return { ...state, signIn, verifyOtp, signOut }
}
