import { useAuth } from '../hooks/useAuth'

export default function Deactivated() {
  const { signOut } = useAuth()

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: '#F1EFE8' }}
    >
      <p className="text-4xl mb-6" aria-hidden="true">🌱</p>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Account deactivated</h1>
      <p className="text-sm text-gray-500 mb-8 max-w-xs leading-relaxed">
        Your account has been deactivated. To start fresh, sign up with a new account.
      </p>
      <div className="w-full max-w-xs">
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
