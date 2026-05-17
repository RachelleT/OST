import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const ACCENT = '#04342C'

export default function Deactivated() {
  const { signOut } = useAuth()
  const [working, setWorking] = useState(false)

  async function handleReactivate() {
    setWorking(true)
    await supabase.rpc('reactivate_account')
    // Reload the page so ProfileContext re-fetches the updated profile
    window.location.reload()
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: '#F1EFE8' }}
    >
      <p className="text-4xl mb-6" aria-hidden="true">🌱</p>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Account deactivated</h1>
      <p className="text-sm text-gray-500 mb-8 max-w-xs leading-relaxed">
        Your account is currently deactivated. You can reactivate at any time to pick up where you left off.
      </p>
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={handleReactivate}
          disabled={working}
          className="w-full rounded-xl py-3 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {working ? 'Reactivating…' : 'Reactivate my account'}
        </button>
        <button
          onClick={() => signOut()}
          className="w-full rounded-xl py-3 text-sm font-medium text-gray-600 border border-gray-200"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
