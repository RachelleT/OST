interface Props {
  streak: number
}

export default function StreakPill({ streak }: Props) {
  return (
    <div
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ background: 'var(--day-accent)', color: 'var(--day-surface)' }}
      aria-label={`${streak} day streak`}
    >
      <span aria-hidden="true">🔥</span>
      <span>{streak} {streak === 1 ? 'day' : 'days'}</span>
    </div>
  )
}
