import { useState } from 'react'
import type React from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  accent: string
  id: string
}

function Toggle({ checked, onChange, disabled, accent, id }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-40"
      style={{
        background: checked ? accent : '#d1d5db',
        '--tw-ring-color': accent,
      } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  )
}

interface Props {
  isPublic: boolean
  onChangePublic: (v: boolean) => void
  accent: string
  bg: string
  disabled?: boolean
}

export default function SharingToggles({
  isPublic,
  onChangePublic,
  accent,
  bg,
  disabled,
}: Props) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="rounded-2xl p-3" style={{ background: bg }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <label htmlFor="toggle-public" className="text-xs font-medium text-gray-800 cursor-pointer">
              Share publicly
            </label>
            <button
              type="button"
              onClick={() => setShowInfo(v => !v)}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 text-[10px] font-semibold text-gray-400 hover:text-gray-600 leading-none flex-shrink-0"
              aria-label="What does this mean?"
            >
              i
            </button>
          </div>
          <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
            Show on the Feed and let admins feature it
          </p>
          {showInfo && (
            <p className="text-[11px] text-gray-500 leading-snug mt-1.5 bg-white/60 rounded-lg px-2 py-1.5">
              Public posts appear on the Feed for all users. Your name only appears if you've enabled that in Settings → Identity.
            </p>
          )}
        </div>
        <Toggle
          id="toggle-public"
          checked={isPublic}
          onChange={onChangePublic}
          disabled={disabled}
          accent={accent}
        />
      </div>
    </div>
  )
}
