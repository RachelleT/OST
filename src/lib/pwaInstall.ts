/**
 * Captures the browser's `beforeinstallprompt` event so we can trigger
 * Chrome's native PWA install dialog on demand (rather than the manual
 * "Add to Home Screen" shortcut flow, which creates a web shortcut instead
 * of a proper standalone app).
 *
 * The event fires once and early — we capture it at module load time so it's
 * never missed regardless of which component is mounted first.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let _prompt: BeforeInstallPromptEvent | null = null
let _listeners: Array<() => void> = []

function notifyListeners() {
  _listeners.forEach(fn => fn())
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // stop the mini-infobar from auto-showing
  _prompt = e as BeforeInstallPromptEvent
  notifyListeners()
})

/** Returns the captured prompt event, or null if not yet fired / already used. */
export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return _prompt
}

/**
 * Trigger the native Chrome install dialog.
 * Returns 'accepted' | 'dismissed', or null if no prompt is available.
 */
export async function triggerInstall(): Promise<'accepted' | 'dismissed' | null> {
  if (!_prompt) return null
  const savedPrompt = _prompt
  _prompt = null          // can only call prompt() once
  notifyListeners()
  await savedPrompt.prompt()
  const { outcome } = await savedPrompt.userChoice
  return outcome
}

/**
 * Subscribe to changes in prompt availability.
 * Returns an unsubscribe function.
 */
export function onInstallPromptChange(fn: () => void): () => void {
  _listeners.push(fn)
  return () => {
    _listeners = _listeners.filter(l => l !== fn)
  }
}
