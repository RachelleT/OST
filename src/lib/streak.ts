/**
 * Given a sorted list of ISO date strings (desc) that the user has posted on,
 * returns { current, longest }.
 *
 * M1 rules: no grace days. Missing a day resets the streak to 1 (today counts).
 */
export function calculateStreaks(postedDates: string[]): { current: number; longest: number } {
  if (postedDates.length === 0) return { current: 0, longest: 0 }

  // Normalise to Date objects sorted descending
  const dates = [...postedDates]
    .map(d => new Date(d + 'T00:00:00'))
    .sort((a, b) => b.getTime() - a.getTime())

  const todayStr = new Date().toISOString().slice(0, 10)
  const today = new Date(todayStr + 'T00:00:00')

  // Current streak: walk backwards from today, counting consecutive days
  let current = 0
  let cursor = today

  for (const date of dates) {
    const diff = Math.round((cursor.getTime() - date.getTime()) / 86_400_000)
    if (diff === 0) {
      current += 1
      cursor = new Date(date.getTime() - 86_400_000) // move cursor back one day
    } else if (diff === 1 && current === 0) {
      // Posted yesterday but not today — still counts as an active streak
      current += 1
      cursor = new Date(date.getTime() - 86_400_000)
    } else if (diff <= 1) {
      current += 1
      cursor = new Date(date.getTime() - 86_400_000)
    } else {
      break // gap found
    }
  }

  // Longest streak: scan all dates for the longest consecutive run
  let longest = 0
  let run = 1
  for (let i = 0; i < dates.length - 1; i++) {
    const diff = Math.round((dates[i].getTime() - dates[i + 1].getTime()) / 86_400_000)
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
