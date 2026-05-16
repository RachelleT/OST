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
  shareNamed: boolean
  displayName: string
  onChangeNamed: (v: boolean) => void
  accent: string
  bg: string
  disabled?: boolean
}

export default function SharingToggles({
  shareNamed,
  displayName,
  onChangeNamed,
  accent,
  bg,
  disabled,
}: Props) {
  return (
    <div className="rounded-2xl p-3" style={{ background: bg }}>
      <div className="flex items-start justify-between gap-3">
        <label htmlFor="toggle-named" className="min-w-0 cursor-pointer">
          <p className="text-xs font-medium text-gray-800">Show my name if featured</p>
          <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
            Shown as '— {displayName || 'you'}' · off means anonymous
          </p>
        </label>
        <Toggle id="toggle-named" checked={shareNamed} onChange={onChangeNamed} disabled={disabled} accent={accent} />
      </div>
    </div>
  )
}
