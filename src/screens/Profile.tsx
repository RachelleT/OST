import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useStreak } from '../hooks/useStreak'

const REMINDER_OPTIONS = ['7:00 AM', '12:00 PM', '6:00 PM', '8:00 PM', '9:00 PM', 'off']
const NEUTRAL_BG = '#F1EFE8'

interface ProfileRow {
  display_name: string
  created_at: string
  current_streak: number
  longest_streak: number
}

export default function Profile() {
  const { user, signOut } = useAuth()
  const { current, longest } = useStreak()

  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [nameError, setNameError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [reminderTime, setReminderTime] = useState(
    () => localStorage.getItem('reminderTime') ?? '8:00 PM'
  )

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('display_name, created_at, current_streak, longest_streak')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data as ProfileRow)
          setDisplayName(data.display_name as string)
        }
      })
  }, [user])

  function handleReminderChange(time: string) {
    setReminderTime(time)
    localStorage.setItem('reminderTime', time)
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
    ? format(new Date(profile.created_at), 'MMMM yyyy')
    : '—'

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
              <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
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

        {/* Reminder time */}
        <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Daily reminder</h2>
          <p className="text-xs text-gray-400">Stored locally for now — notifications come in M2.</p>
          <fieldset>
            <legend className="sr-only">Choose reminder time</legend>
            <div className="grid grid-cols-3 gap-2">
              {REMINDER_OPTIONS.map(time => (
                <label
                  key={time}
                  className="flex items-center justify-center rounded-xl py-2 px-2 text-xs font-medium cursor-pointer border-2 transition-colors text-center"
                  style={{
                    borderColor: reminderTime === time ? '#2DBFA8' : 'transparent',
                    background: reminderTime === time ? '#E1F5EE' : '#f9fafb',
                    color: reminderTime === time ? '#04342C' : '#6b7280',
                  }}
                >
                  <input
                    type="radio"
                    name="reminder-profile"
                    value={time}
                    checked={reminderTime === time}
                    onChange={() => handleReminderChange(time)}
                    className="sr-only"
                  />
                  {time === 'off' ? 'No reminder' : time}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Account */}
        <div className="rounded-2xl bg-white p-4 shadow-sm space-y-1">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Account</h2>
          <p className="text-xs text-gray-400 mb-3">{user?.email}</p>
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
