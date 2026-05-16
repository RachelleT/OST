import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../lib/ProfileContext'
import { supabase } from '../../lib/supabase'

const ADMIN_BG = '#F1EFE8'
const ACCENT = '#04342C'

interface NavItem {
  to: string
  label: string
  icon: string
  badge?: number
}

const BASE_NAV: Omit<NavItem, 'badge'>[] = [
  { to: '/admin/prompts',     label: 'Prompts',    icon: '✦' },
  { to: '/admin/notes',       label: 'Notes',      icon: '🌱' },
  { to: '/admin/posts',       label: 'Posts',      icon: '📋' },
  { to: '/admin/featured',    label: 'Featured',   icon: '⭐' },
  { to: '/admin/moderation',  label: 'Queue',      icon: '🛡️' },
  { to: '/admin/admins',      label: 'Admins',     icon: '🔑' },
]

export default function AdminLayout() {
  const { signOut } = useAuth()
  const profile = useProfile()
  const navigate = useNavigate()
  const [moderationCount, setModerationCount] = useState(0)

  useEffect(() => {
    supabase.rpc('get_moderation_queue_count').then(({ data }) => {
      if (typeof data === 'number') setModerationCount(data)
    })
  }, [])

  const NAV_ITEMS: NavItem[] = BASE_NAV.map(item => ({
    ...item,
    badge: item.to === '/admin/moderation' && moderationCount > 0 ? moderationCount : undefined,
  }))

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="h-full flex flex-col" style={{ background: ADMIN_BG }}>

      {/* Top bar */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b bg-white"
        style={{ borderColor: '#e5e7eb' }}
      >
        <span className="text-sm font-semibold" style={{ color: ACCENT }}>
          Admin
        </span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">{profile?.displayName}</span>
          <NavLink
            to="/"
            className="text-xs font-medium text-gray-500 hover:text-gray-800"
          >
            ← Back to app
          </NavLink>
          <button
            onClick={handleSignOut}
            className="text-xs font-medium text-red-500 hover:text-red-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1">

        {/* Sidebar — desktop */}
        <nav
          className="hidden md:flex flex-col w-48 shrink-0 border-r bg-white py-4"
          style={{ borderColor: '#e5e7eb' }}
          aria-label="Admin navigation"
        >
          {NAV_ITEMS.map(({ to, label, icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-[#04342C] bg-[#E1F5EE]'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`
              }
            >
              <span aria-hidden="true">{icon}</span>
              {label}
              {badge != null && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar — in normal flow so iOS keyboard cannot move it */}
      <nav
        className="md:hidden shrink-0 border-t bg-white pb-safe"
        style={{ borderColor: '#e5e7eb' }}
        aria-label="Admin navigation"
      >
        <div className="h-16 flex items-center">
          {NAV_ITEMS.map(({ to, label, icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-[#04342C]' : 'text-gray-400'
                }`
              }
            >
              <span aria-hidden="true" className="relative text-lg leading-none">
                {icon}
                {badge != null && (
                  <span className="absolute -top-1 -right-2 text-[9px] font-bold px-1 rounded-full bg-red-500 text-white leading-tight">
                    {badge}
                  </span>
                )}
              </span>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
