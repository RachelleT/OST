import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { ProfileProvider } from './lib/ProfileContext'
import SignIn from './screens/SignIn'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import History from './screens/History'
import Profile from './screens/Profile'
import PaletteDebug from './screens/PaletteDebug'
import BottomNav from './components/BottomNav'

function Spinner() {
  return (
    <div className="min-h-full flex items-center justify-center" style={{ background: '#FAF5EC' }}>
      <span className="sr-only">Loading…</span>
      <div
        className="w-8 h-8 rounded-full border-2 border-transparent animate-spin"
        style={{ borderTopColor: '#2DBFA8' }}
        aria-hidden="true"
      />
    </div>
  )
}

function AuthedApp() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  const { user, isLoading } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return
    setShowOnboarding(!localStorage.getItem('onboardingDone'))
  }, [user])

  function completeOnboarding() {
    localStorage.setItem('onboardingDone', '1')
    setShowOnboarding(false)
  }

  if (window.location.pathname === '/palette-debug') return <PaletteDebug />
  if (isLoading) return <Spinner />
  if (!user) return <BrowserRouter><SignIn /></BrowserRouter>
  if (showOnboarding === null) return <Spinner />

  if (showOnboarding) {
    // ProfileProvider needed here too so onboarding can access profile if needed
    return (
      <ProfileProvider>
        <Onboarding onComplete={completeOnboarding} />
      </ProfileProvider>
    )
  }

  return (
    <ProfileProvider>
      <BrowserRouter>
        <AuthedApp />
      </BrowserRouter>
    </ProfileProvider>
  )
}
