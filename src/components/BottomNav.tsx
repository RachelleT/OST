import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/',        label: 'Today',   icon: '✦' },
  { to: '/history', label: 'History', icon: '📅' },
  { to: '/profile', label: 'You',     icon: '👤' },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 flex items-center justify-around border-t bg-white/90 backdrop-blur-sm pb-safe"
      style={{ borderColor: '#e5e7eb', height: 64 }}
      aria-label="Main navigation"
    >
      {TABS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-6 py-2 text-xs font-medium transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-40'
            }`
          }
          style={{ color: 'var(--day-accent, #04342C)' }}
          aria-label={label}
        >
          <span aria-hidden="true" className="text-lg leading-none">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
