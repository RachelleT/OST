import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

function InstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 space-y-5 pb-10">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Add to home screen</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span aria-hidden="true">🍎</span> iPhone
          </p>
          <ol className="text-sm text-gray-600 space-y-1 list-none">
            <li>1. Open in <strong>Safari</strong></li>
            <li>2. Tap the <strong>···</strong> button at the bottom</li>
            <li>3. Tap the <strong>Share</strong> button</li>
            <li>4. Scroll down and tap <strong>"Add to Home Screen"</strong></li>
          </ol>
        </div>

        <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span aria-hidden="true">🤖</span> Android
          </p>
          <ol className="text-sm text-gray-600 space-y-1 list-none">
            <li>1. Open in <strong>Chrome</strong></li>
            <li>2. Tap the <strong>⋮ menu</strong> in the top right</li>
            <li>3. Tap <strong>"Add to Home screen"</strong></li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default function SignIn() {
  const { signIn, verifyOtp } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'verifying' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [showInstall, setShowInstall] = useState(false)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    const { error } = await signIn(email.trim())
    if (error) {
      setErrorMsg(error)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.replace(/\s/g, '')
    if (trimmed.length !== 6) return
    setStatus('verifying')
    const { error } = await verifyOtp(email, trimmed)
    if (error) {
      setErrorMsg(error)
      setStatus('sent')
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-12" style={{ background: '#FAF5EC' }}>
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="mb-10 text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: '#2DBFA8' }}
            aria-hidden="true"
          >
            <span className="text-2xl">✦</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">One Small Thing</h1>
          <p className="mt-1 text-sm text-gray-500">One prompt a day, just for you.</p>
        </div>

        {status === 'idle' || status === 'loading' || status === 'error' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => { setEmail(e.target.value); setErrorMsg('') }}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{ '--tw-ring-color': '#2DBFA8' } as React.CSSProperties}
                disabled={status === 'loading'}
              />
            </div>

            {status === 'error' && (
              <p role="alert" className="text-sm text-red-600">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !email.trim()}
              className="w-full rounded-full py-3.5 text-sm font-medium text-white transition-transform active:scale-95 disabled:opacity-50"
              style={{ background: '#04342C' }}
            >
              {status === 'loading' ? 'Sending…' : 'Continue'}
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-2"
                style={{ background: '#E1F5EE' }}
                aria-hidden="true"
              >
                <span className="text-2xl">✉️</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
              <p className="text-sm text-gray-500">
                We sent a 6-digit code to <strong>{email}</strong>.
              </p>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                  Enter code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d*"
                  maxLength={6}
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setErrorMsg('') }}
                  placeholder="123456"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-2xl text-center tracking-widest text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ '--tw-ring-color': '#2DBFA8' } as React.CSSProperties}
                  disabled={status === 'verifying'}
                  autoFocus
                />
              </div>

              {errorMsg && (
                <p role="alert" className="text-sm text-red-600">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === 'verifying' || code.length !== 6}
                className="w-full rounded-full py-3.5 text-sm font-medium text-white transition-transform active:scale-95 disabled:opacity-50"
                style={{ background: '#04342C' }}
              >
                {status === 'verifying' ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="text-center space-y-2">
              <p className="text-xs text-gray-400">
                The email also contains a sign-in link if you prefer.
              </p>
              <button
                onClick={() => { setStatus('idle'); setCode(''); setErrorMsg('') }}
                className="text-sm underline text-gray-500 hover:text-gray-700"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Install hint */}
      <button
        onClick={() => setShowInstall(true)}
        className="mt-8 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="How to add to home screen"
      >
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-300 text-gray-400 text-xs font-semibold leading-none">?</span>
        Add to home screen
      </button>

      {showInstall && <InstallSheet onClose={() => setShowInstall(false)} />}
    </div>
  )
}
