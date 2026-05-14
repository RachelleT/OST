import { userToday } from './date'

/**
 * Given a sorted list of ISO date strings the user has posted on,
 * returns { current, longest }.
 *
 * M1: no grace days. M2 adds grace — see submit_post RPC for server-side logic.
 * The client-side function here is used for display only.
 */
export function calculateStreaks(
  postedDates: string[],
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): { current: number; longest: number } {
  if (postedDates.length === 0) return { current: 0, longest: 0 }

  const dates = [...postedDates].sort().reverse() // desc
  const today = userToday(timezone)

  let current = 0
  let cursorStr = today

  for (const dateStr of dates) {
    const cursorMs = new Date(cursorStr + 'T12:00:00').getTime()
    const dateMs   = new Date(dateStr   + 'T12:00:00').getTime()
    const diffDays = Math.round((cursorMs - dateMs) / 86_400_000)

    if (diffDays === 0 || diffDays === 1) {
      current += 1
      // Move cursor to the day before this post
      const prev = new Date(dateMs - 86_400_000)
      cursorStr = prev.toISOString().slice(0, 10)
    } else {
      break
    }
  }

  // Longest: scan for longest consecutive run
  let longest = 0
  let run = 1
  for (let i = 0; i < dates.length - 1; i++) {
    const a = new Date(dates[i]   + 'T12:00:00').getTime()
    const b = new Date(dates[i+1] + 'T12:00:00').getTime()
    const diff = Math.round((a - b) / 86_400_000)
    if (diff === 1) {
      run += 1
    } else {
      longest = Math.max(longest, run)
      run = 1
    }
  }
  longest = Math.max(longest, run)

  return { current, longest }
}
