import type { Note } from '../lib/notes'

interface Props {
  note: Note
  pool: 'empty_state' | 'completed_state'
}

const EMOJI: Record<string, string> = {
  empty_state:     '🌱',
  completed_state: '👀',
}

export default function WarmNote({ note, pool }: Props) {
  return (
    <div
      className="flex items-start gap-3 rounded-[18px] px-4"
      style={{
        background: 'rgba(255,255,255,0.55)',
        padding: '14px 16px',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1.3, flexShrink: 0 }} aria-hidden="true">
        {EMOJI[pool]}
      </span>
      <div>
        <p
          className="font-medium leading-snug"
          style={{ fontSize: 13, color: 'var(--day-text-on-bg)' }}
        >
          {note.text}
        </p>
        {pool === 'empty_state' && (
          <p
            className="mt-0.5"
            style={{ fontSize: 11, color: 'var(--day-text-on-bg)', opacity: 0.7 }}
          >
            a little note for today
          </p>
        )}
      </div>
    </div>
  )
}
