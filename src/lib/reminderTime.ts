export const REMINDER_OPTIONS: { label: string; value: string | null }[] = [
  { label: '7:00 AM',    value: '07:00' },
  { label: '12:00 PM',   value: '12:00' },
  { label: '6:00 PM',    value: '18:00' },
  { label: '8:00 PM',    value: '20:00' },
  { label: '9:00 PM',    value: '21:00' },
  { label: 'No reminder', value: null   },
]

/** Converts a DB time string ('HH:MM' or 'HH:MM:SS') to a display label. */
export function reminderLabel(dbTime: string | null | undefined): string | null {
  if (!dbTime) return null
  const hhmm = dbTime.slice(0, 5)
  return REMINDER_OPTIONS.find(o => o.value === hhmm)?.label ?? null
}
