import { userToday } from './date'

export function calculateStreaks(
  postedDates: string[],
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): { current: number; longest: number } {
  if (postedDates.length === 0) return { current: 0, longest: 0 }

  const dates = [...new Set(postedDates)].sort().reverse() // dedup, desc
  const today = userToday(timezone)

  // Current streak: consecutive days ending today or yesterday
  let current = 0
  let cursorStr = today

  for (const dateStr of dates) {
    const cursorMs = new Date(cursorStr + 'T12:00:00').getTime()
    const dateMs   = new Date(dateStr  + 'T12:00:00').getTime()
    const diffDays = Math.round((cursorMs - dateMs) / 86_400_000)

    if (current === 0) {
      // First post: must be today or yesterday to start a streak
      if (diffDays === 0 || diffDays === 1) {
        current = 1
        cursorStr = dateStr // cursor sits ON the post date
      } else {
        break
      }
    } else {
      // Each subsequent post must be exactly 1 day before the cursor
      if (diffDays === 1) {
        current += 1
        cursorStr = dateStr
      } else {
        break
      }
    }
  }

  // Longest: find the longest consecutive run in history
  let longest = dates.length > 0 ? 1 : 0
  let run = 1
  for (let i = 0; i < dates.length - 1; i++) {
    const a = new Date(dates[i]   + 'T12:00:00').getTime()
    const b = new Date(dates[i+1] + 'T12:00:00').getTime()
    const diff = Math.round((a - b) / 86_400_000)
    if (diff === 1) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 1
    }
  }

  return { current, longest: Math.max(longest, current) }
}
