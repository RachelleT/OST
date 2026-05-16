import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../lib/ProfileContext'

interface Props {
  children: ReactNode
}

export default function RequireAdmin({ children }: Props) {
  const { user, isLoading } = useAuth()
  const profile = useProfile()
  const location = useLocation()

  // Still resolving auth state
  if (isLoading || (user && profile === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F1EFE8' }}>
        <div
          className="w-8 h-8 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: '#2DBFA8' }}
          aria-hidden="true"
        />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  // Not signed in — redirect to sign-in, preserve intended destination
  if (!user) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />
  }

  // Signed in but not admin — bounce to app root silently
  if (!profile?.isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
