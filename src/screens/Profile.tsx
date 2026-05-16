import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../lib/ProfileContext'
import { useStreak } from '../hooks/useStreak'
import {
  isPushSupported,
  isIOS,
  isInstalledPWA,
  getPushPermissionState,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/push'
import { REMINDER_OPTIONS } from '../lib/reminderTime'

const NEUTRAL_BG = '#F1EFE8'

interface ProfileRow {
  display_name: string
  created_at: string
  current_streak: number
  longest_streak: number
  reminder_time: string | null
  timezone: string
}

export default function Profile() {
  const { user, signOut } = useAuth()
  const { current, longest } = useStreak()
  const profileCtx = useProfile()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [nameError, setNameError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  // reminderValue is the HH:MM string stored in the DB, or null for "off"
  const [reminderValue, setReminderValue] = useState<string | null>('20:00')
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifWorking, setNotifWorking] = useState(false)
  const [timezone, setTimezone] = useState('')
  const [tzSaving, setTzSaving] = useState(false)
  const [tzSaved, setTzSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('display_name, created_at, current_streak, longest_streak, reminder_time, timezone')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const row = data as ProfileRow
          setProfile(row)
          setDisplayName(row.display_name)
          setReminderValue(row.reminder_time ? row.reminder_time.slice(0, 5) : null)
          setTimezone(row.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)
        }
      })

    // Check if this device has push enabled
    const state = getPushPermissionState()
    navigator.serviceWorker?.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setNotifEnabled(state === 'granted' && sub !== null)
    }).catch(() => {})
  }, [user])

  async function handleReminderChange(value: string | null) {
    setReminderValue(value)
    if (!user) return
    await supabase
      .from('profiles')
      .update({ reminder_time: value })
      .eq('id', user.id)
  }

  function detectTimezone() {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }

  async function saveTimezone() {
    if (!user || !timezone.trim()) return
    setTzSaving(true)
    await supabase.from('profiles').update({ timezone: timezone.trim() }).eq('id', user.id)
    setTzSaving(false)
    setTzSaved(true)
    setTimeout(() => setTzSaved(false), 2500)
  }

  async function toggleNotifications() {
    setNotifWorking(true)
    if (notifEnabled) {
      await unsubscribeFromPush()
      setNotifEnabled(false)
    } else {
      const { ok } = await subscribeToPush()
      if (ok) setNotifEnabled(true)
    }
    setNotifWorking(false)
  }

  async function saveName() {
    const trimmed = displayName.trim()
    if (trimmed.length < 3 || trimmed.length > 30) {
      setNameError('Name must be 3–30 characters')
      return
    }
    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      setNameError('Letters, numbers, and spaces only')
      return
    }
    setNameError('')
    setIsSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user!.id)
    setIsSaving(false)
    if (!error) {
      setProfile(p => p ? { ...p, display_name: trimmed } : p)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 2500)
    }
  }

  const memberSince = profile?.created_at
    ? format(new Date(profile.created_at), 'yyyy')
    : '—'

  const ios = isIOS()
  const installed = isInstalledPWA()
  const pushSupported = isPushSupported()
  const showNotifToggle = pushSupported && (!ios || installed)
  const showInstallFirst = ios && !installed

  return (
    <div className="min-h-full pb-20" style={{ background: NEUTRAL_BG }}>
      <div className="px-5 pt-12 space-y-6">
        <h1 className="text-xl font-semibold text-gray-900">You</h1>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Current streak', value: current },
            { label: 'Longest streak', value: longest },
            { label: 'Member since', value: memberSince },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl bg-white p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Display name */}
        <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Display name</h2>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="display-name" className="sr-only">Display name</label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setNameError('') }}
                maxLength={30}
                placeholder="Your name"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{ '--tw-ring-color': '#2DBFA8' } as React.CSSProperties}
              />
              {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
            </div>
            <button
              onClick={saveName}
              disabled={isSaving || displayName.trim() === (profile?.display_name ?? '')}
              className="rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-40 transition-opacity"
              style={{ background: '#04342C' }}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {savedToast && (
            <p className="text-xs text-green-600 font-medium" role="status">Name updated ✓</p>
          )}
        </div>

        {/* Reminders */}
        <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Daily reminder</h2>

          {/* Notification toggle */}
          {showInstallFirst && (
            <p className="text-xs text-gray-500 leading-relaxed">
              To get notifications on iPhone, tap <strong>Share</strong> in Safari then <strong>Add to Home Screen</strong> first.
            </p>
          )}
          {showNotifToggle && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">
                {notifEnabled ? 'Reminders on' : 'Reminders off'}
              </span>
              <button
                onClick={toggleNotifications}
                disabled={notifWorking}
                className="text-xs font-medium px-3 py-1.5 rounded-full border disabled:opacity-50 transition-colors"
                style={{
                  borderColor: '#2DBFA8',
                  color: notifEnabled ? '#fff' : '#2DBFA8',
                  background: notifEnabled ? '#2DBFA8' : 'transparent',
                }}
              >
                {notifWorking ? '…' : notifEnabled ? 'Turn off' : 'Turn on'}
              </button>
            </div>
          )}

          {/* Time picker — only meaningful when notifications are on */}
          <fieldset>
            <legend className="sr-only">Choose reminder time</legend>
            <div className="grid grid-cols-3 gap-2">
              {REMINDER_OPTIONS.map(({ label, value }) => (
                <label
                  key={label}
                  className="flex items-center justify-center rounded-xl py-2 px-2 text-xs font-medium cursor-pointer border-2 transition-colors text-center"
                  style={{
                    borderColor: reminderValue === value ? '#2DBFA8' : 'transparent',
                    background: reminderValue === value ? '#E1F5EE' : '#f9fafb',
                    color: reminderValue === value ? '#04342C' : '#6b7280',
                  }}
                >
                  <input
                    type="radio"
                    name="reminder-profile"
                    value={value ?? 'off'}
                    checked={reminderValue === value}
                    onChange={() => handleReminderChange(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Timezone */}
        <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Timezone</h2>
          <p className="text-xs text-gray-400">
            Used to send reminders at the right local time.
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="timezone" className="sr-only">Timezone</label>
              <input
                id="timezone"
                type="text"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                placeholder="e.g. America/New_York"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{ '--tw-ring-color': '#2DBFA8' } as React.CSSProperties}
              />
            </div>
            <button
              onClick={detectTimezone}
              className="rounded-xl px-3 py-2 text-xs font-medium border border-gray-200 text-gray-600 whitespace-nowrap"
            >
              Detect
            </button>
            <button
              onClick={saveTimezone}
              disabled={tzSaving}
              className="rounded-xl px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              style={{ background: '#04342C' }}
            >
              {tzSaving ? '…' : 'Save'}
            </button>
          </div>
          {tzSaved && (
            <p className="text-xs text-green-600 font-medium" role="status">Timezone updated ✓</p>
          )}
        </div>

        {/* Account */}
        <div className="rounded-2xl bg-white p-4 shadow-sm space-y-1">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Account</h2>
          <p className="text-xs text-gray-400 mb-3">{user?.email}</p>
          {profileCtx?.isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full rounded-xl py-2.5 text-sm font-medium border transition-opacity active:opacity-70 mb-2"
              style={{ borderColor: '#04342C', color: '#04342C' }}
            >
              Admin dashboard
            </button>
          )}
          <button
            onClick={signOut}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-red-600 border border-red-100 bg-red-50 transition-opacity active:opacity-70"
          >
            Sign out
          </button>
          <p className="text-xs text-gray-400 text-center pt-2">
            To delete your account, email the admin.
          </p>
        </div>
      </div>
    </div>
  )
}
