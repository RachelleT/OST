import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string


export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isInstalledPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function getPushPermissionState(): NotificationPermission {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: 'Push not supported' }
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'VAPID key not configured' }

  try {
    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    if (existing) await existing.unsubscribe()

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not signed in' }

    const sub = subscription.toJSON() as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    }, { onConflict: 'user_id,endpoint' })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: msg }
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
  }
}
