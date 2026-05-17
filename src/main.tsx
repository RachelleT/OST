import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// When a new service worker takes control, reload once to apply the update.
// The refreshing guard prevents a double-reload loop.
if ('serviceWorker' in navigator) {
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  // If a SW is already waiting when the page loads (e.g. update landed
  // while the app was backgrounded), activate it immediately.
  navigator.serviceWorker.ready.then(reg => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    reg.update().catch(() => {})

    // Re-check for updates every time the app comes back into the foreground.
    // iOS can otherwise delay SW update checks by up to 24 hours.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        reg.update().catch(() => {})
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    })
  })
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
