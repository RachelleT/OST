// ----------------------------------------------------------------
// Timezone-aware date helpers
// All "what day is it" decisions use the user's stored timezone.
// ----------------------------------------------------------------

/**
 * Returns today's date as YYYY-MM-DD in the given IANA timezone.
 * Uses en-CA locale which formats as YYYY-MM-DD natively.
 */
export function userToday(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Returns yesterday's date as YYYY-MM-DD in the given timezone. */
export function userYesterday(timezone: string): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Returns the Monday of the week containing dateStr (YYYY-MM-DD)
 * as a YYYY-MM-DD string, computed in the given timezone.
 */
export function weekStartTz(dateStr: string, timezone: string): string {
  // Parse the date string as a local date in the user's timezone
  const [year, month, day] = dateStr.split('-').map(Number)
  // Build a Date that represents midnight of that date in the user's TZ
  // by formatting known offsets — simpler: treat dateStr as a local wall-clock date
  const d = new Date(`${dateStr}T12:00:00`) // noon avoids DST edge cases
  // Map weekday name to offset from Monday
  const name = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(d)
  const offsets: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const offset = offsets[name] ?? 0
  const monday = new Date(Date.UTC(year, month - 1, day - offset))
  return monday.toISOString().slice(0, 10)
}

/** Returns true if the two YYYY-MM-DD strings are the same day. */
export function isSameDay(a: string, b: string): boolean {
  return a === b
}

// ----------------------------------------------------------------
// Legacy helpers (used by calendar display — timezone-naive is fine
// for display-only purposes where we show the user their own history)
// ----------------------------------------------------------------

/** Returns the Monday of the week containing the given Date (local time). */
export function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Returns 7 Dates starting from the given Monday (local time). */
export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

/** ISO date string (YYYY-MM-DD) from a Date using local time. */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
