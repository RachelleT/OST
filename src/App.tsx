import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { ProfileProvider } from './lib/ProfileContext'
import { supabase } from './lib/supabase'
import SignIn from './screens/SignIn'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import History from './screens/History'
import Profile from './screens/Profile'
import PaletteDebug from './screens/PaletteDebug'
import BottomNav from './components/BottomNav'
import RequireAdmin from './components/RequireAdmin'
import AdminLayout from './screens/Admin/AdminLayout'
import AdminPrompts from './screens/Admin/Prompts'
import AdminNotes from './screens/Admin/Notes'
import AdminPosts from './screens/Admin/Posts'
import AdminFeatured from './screens/Admin/Featured'
import AdminAdmins from './screens/Admin/Admins'
import AdminModeration from './screens/Admin/Moderation'
import PublicPost from './screens/PublicPost'

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
    <div className="app-shell flex flex-col min-h-full">
      <div className="flex-1 flex flex-col" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}>
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

function AdminApp() {
  return (
    <RequireAdmin>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/prompts" replace />} />
          <Route path="prompts"  element={<AdminPrompts />} />
          <Route path="notes"    element={<AdminNotes />} />
          <Route path="posts"    element={<AdminPosts />} />
          <Route path="featured"    element={<AdminFeatured />} />
          <Route path="admins"      element={<AdminAdmins />} />
          <Route path="moderation"  element={<AdminModeration />} />
        </Route>
      </Routes>
    </RequireAdmin>
  )
}

export default function App() {
  const { user, isLoading } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return
    if (localStorage.getItem('onboardingDone')) {
      setShowOnboarding(false)
      return
    }
    supabase
      .from('profiles')
      .select('created_at')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) { setShowOnboarding(true); return }
        const isNew = Date.now() - new Date(data.created_at as string).getTime() < 5 * 60 * 1000
        if (!isNew) localStorage.setItem('onboardingDone', '1')
        setShowOnboarding(isNew)
      })
  }, [user])

  function completeOnboarding() {
    localStorage.setItem('onboardingDone', '1')
    setShowOnboarding(false)
  }

  if (window.location.pathname === '/palette-debug') return <PaletteDebug />
  if (window.location.pathname.startsWith('/p/')) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/p/:postId" element={<PublicPost />} />
        </Routes>
      </BrowserRouter>
    )
  }
  if (isLoading) return <Spinner />

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<SignIn />} />
        </Routes>
      </BrowserRouter>
    )
  }

  if (showOnboarding === null) return <Spinner />

  if (showOnboarding) {
    return (
      <ProfileProvider>
        <Onboarding onComplete={completeOnboarding} />
      </ProfileProvider>
    )
  }

  return (
    <ProfileProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<AuthedApp />} />
        </Routes>
      </BrowserRouter>
    </ProfileProvider>
  )
}
