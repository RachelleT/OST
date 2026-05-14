/** Returns the Monday of the week containing the given date. */
export function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // shift Sunday back 6, others to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Returns an array of 7 Dates starting from the given Monday. */
export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

/** ISO date string (YYYY-MM-DD) for a Date. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
