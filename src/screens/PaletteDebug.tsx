import { dayPalette } from '../lib/palette'
import DayBackground from '../components/DayBackground'

// Reference date: Monday 2026-05-11 (a known Monday)
const BASE = new Date('2026-05-11T12:00:00')

const DAYS = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(BASE)
  d.setDate(BASE.getDate() + i)
  return d
})

export default function PaletteDebug() {
  return (
    <div className="flex flex-wrap gap-3 p-4 bg-gray-100 min-h-full">
      {DAYS.map((date) => {
        const p = dayPalette(date)
        return (
          <div
            key={p.dayName}
            className="relative rounded-3xl overflow-hidden flex-shrink-0"
            style={{ width: 160, height: 290, background: p.bg }}
          >
            <DayBackground palette={p} />
            <div className="relative z-10 p-3">
              <p className="text-sm font-semibold" style={{ color: p.textOnBg }}>
                {p.dayName}
              </p>
              <p className="text-xs mt-1 opacity-70" style={{ color: p.textOnBg }}>
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
