import { supabase } from './supabase'
import { userToday } from './date'

export interface Note {
  id: string
  text: string
  pool: 'empty_state' | 'completed_state'
  day_of_week: number | null
}

// Deterministic integer hash — no Math.random() anywhere in this file.
function hashString(s: string): number {
  let h = 2166136261 // FNV-1a 32-bit offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0 // keep unsigned 32-bit
  }
  return h
}

/**
 * Returns one note from the given pool, stable for (userId, date, pool).
 * Prefers day-of-week-tagged notes when today's weekday matches; falls back
 * to untagged notes if none match. Returns null only if the pool is empty.
 *
 * day_of_week encoding: 0=Monday .. 6=Sunday (matching JS Date.getDay() - 1
 * with Sunday wrapped to 6).
 */
export async function noteForToday(
  userId: string,
  timezone: string,
  pool: 'empty_state' | 'completed_state',
): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('id, text, pool, day_of_week')
    .eq('pool', pool)
    .eq('active', true)

  if (error || !data || data.length === 0) return null

  const notes = data as Note[]

  // Compute today's day-of-week (0=Mon..6=Sun) in user's timezone
  const todayStr = userToday(timezone)
  const d = new Date(todayStr + 'T12:00:00')
  const jsDay = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(d)
  const dowMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const todayDow = dowMap[jsDay] ?? 0

  // Prefer day-tagged candidates for today; fall back to untagged
  const dayTagged = notes.filter(n => n.day_of_week === todayDow)
  const untagged  = notes.filter(n => n.day_of_week === null)
  const candidates = dayTagged.length > 0 ? dayTagged : untagged

  if (candidates.length === 0) return null

  // Stable selection within the day
  const seed = hashString(`${userId}:${todayStr}:${pool}`)
  return candidates[seed % candidates.length]
}
