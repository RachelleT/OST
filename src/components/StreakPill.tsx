const MILESTONES = [3, 7, 14, 30, 60, 100]

interface Props {
  streak: number
}

function isMilestone(streak: number): boolean {
  return MILESTONES.includes(streak)
}

export { MILESTONES }

export default function StreakPill({ streak }: Props) {
  const milestone = isMilestone(streak)

  return (
    <div
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-shadow"
      style={{
        background: 'var(--day-accent)',
        color: 'var(--day-surface)',
        boxShadow: milestone
          ? '0 0 0 3px var(--day-surface), 0 0 0 5px var(--day-accent)'
          : undefined,
      }}
      aria-label={`${streak} day streak${milestone ? ' — milestone!' : ''}`}
    >
      <span aria-hidden="true">{milestone ? '✨' : '🔥'}</span>
      <span>{streak} {streak === 1 ? 'day' : 'days'}</span>
    </div>
  )
}
