import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

function TodayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 2 L11.6 8.4 L18 10 L11.6 11.6 L10 18 L8.4 11.6 L2 10 L8.4 8.4 Z" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="2.5" width="11" height="15" rx="1.5" />
      <line x1="7" y1="7" x2="13" y2="7" />
      <line x1="7" y1="10.5" x2="13" y2="10.5" />
      <line x1="7" y1="14" x2="11" y2="14" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="10" cy="7.5" r="3" />
      <path d="M3.5 17.5C3.5 14.5 6.5 12 10 12s6.5 2.5 6.5 5.5" />
    </svg>
  )
}

const TABS: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/',        label: 'Today',   icon: <TodayIcon /> },
  { to: '/history', label: 'History', icon: <HistoryIcon /> },
  { to: '/profile', label: 'You',     icon: <ProfileIcon /> },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 border-t bg-white/90 backdrop-blur-sm pb-safe"
      style={{ borderColor: '#e5e7eb' }}
      aria-label="Main navigation"
    >
      <div className="h-16 flex items-center justify-around">
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
            {icon}
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
