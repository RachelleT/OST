import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../hooks/useAuth'

interface Profile {
  id: string
  displayName: string
  timezone: string
  reminderTime: string | null
  isAdmin: boolean
  isDeactivated: boolean
  currentStreak: number
  longestStreak: number
}

const ProfileContext = createContext<Profile | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)

  function fetchProfile(uid: string) {
    supabase
      .from('profiles')
      .select('id, display_name, timezone, reminder_time, is_admin, current_streak, longest_streak, deactivated_at')
      .eq('id', uid)
      .single()
      .then(({ data }) => {
        if (!data) return
        const row = data as Record<string, unknown>
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const storedTz = row.timezone as string

        // One-time fix: if profile still has the M1 default 'UTC' (or differs from browser),
        // update it to the detected timezone
        if (storedTz === 'UTC' && detectedTz !== 'UTC') {
          supabase
            .from('profiles')
            .update({ timezone: detectedTz })
            .eq('id', uid)
            .then(() => {})
        }

        setProfile({
          id: row.id as string,
          displayName: row.display_name as string,
          timezone: storedTz === 'UTC' ? detectedTz : storedTz,
          reminderTime: row.reminder_time as string | null,
          isAdmin: row.is_admin as boolean,
          isDeactivated: row.deactivated_at !== null,
          currentStreak: row.current_streak as number,
          longestStreak: row.longest_streak as number,
        })
      })
  }

  useEffect(() => {
    if (!user) { setProfile(null); return }
    const uid = user.id
    fetchProfile(uid)

    // Re-fetch when Profile screen saves a change (name, timezone, etc.)
    function onUpdated() { fetchProfile(uid) }
    window.addEventListener('profile-updated', onUpdated)
    return () => window.removeEventListener('profile-updated', onUpdated)
  }, [user])

  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}

/** Returns the user's profile. Null while loading or signed out. */
export function useProfile(): Profile | null {
  return useContext(ProfileContext)
}

/** Returns the user's IANA timezone, falling back to browser detection. */
export function useTimezone(): string {
  const profile = useProfile()
  return profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
}
