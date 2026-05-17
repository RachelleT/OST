import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { REMINDER_OPTIONS } from '../lib/reminderTime'

interface Props {
  onComplete: () => void
}

const slide = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit:    { opacity: 0, y: -16, transition: { duration: 0.15 } },
}

const TOTAL_STEPS = 5

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [nameError, setNameError] = useState('')
  const [reminderValue, setReminderValue] = useState<string | null>('20:00')
  const [saving, setSaving] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  async function next() {
    // Validate name step
    if (step === 1) {
      const trimmed = displayName.trim()
      if (trimmed.length < 3) {
        setNameError('Name must be at least 3 characters')
        nameInputRef.current?.focus()
        return
      }
      if (trimmed.length > 30) {
        setNameError('Name must be 30 characters or fewer')
        nameInputRef.current?.focus()
        return
      }
      setNameError('')
    }

    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1)
      return
    }

    // Final step — save name + reminder
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          reminder_time: reminderValue,
        })
        .eq('id', user.id)
    }
    setSaving(false)
    onComplete()
  }

  return (
    <div className="min-h-full flex flex-col px-6 py-12" style={{ background: '#FAF5EC' }}>
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-10">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-colors"
            style={{ background: i === step ? '#2DBFA8' : '#d1d5db' }}
            aria-hidden="true"
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 0 — Welcome */}
        {step === 0 && (
          <motion.div key="step0" {...slide} className="flex-1 flex flex-col justify-center text-center">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
              style={{ background: '#2DBFA8' }}
            >
              <span className="text-3xl" aria-hidden="true">✦</span>
            </div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-3 tracking-tight">
              One Small Thing
            </h1>
            <p className="text-gray-500 text-base leading-relaxed max-w-xs mx-auto">
              One prompt a day. Build something quiet, just for you.
            </p>
          </motion.div>
        )}

        {/* Step 1 — Name */}
        {step === 1 && (
          <motion.div key="step1" {...slide} className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-1 tracking-tight">
                What should we call you?
              </h2>
              <p className="text-sm text-gray-500">
                This is how you'll appear to yourself on your profile.
              </p>
            </div>
            <div>
              <label htmlFor="display-name" className="sr-only">Your name</label>
              <input
                id="display-name"
                ref={nameInputRef}
                type="text"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setNameError('') }}
                placeholder="Your name"
                maxLength={30}
                autoComplete="name"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#2DBFA8' } as React.CSSProperties}
              />
              {nameError && (
                <p className="text-xs text-red-500 mt-2">{nameError}</p>
              )}
              <p className="text-xs text-gray-400 mt-2 text-right">
                {displayName.trim().length}/30
              </p>
            </div>
          </motion.div>
        )}

        {/* Step 2 — How it works */}
        {step === 2 && (
          <motion.div key="step2" {...slide} className="flex-1 flex flex-col justify-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 tracking-tight">How it works</h2>
            <ul className="space-y-5">
              {[
                { icon: '🌅', text: 'One new prompt every day, chosen just for you' },
                { icon: '✏️', text: 'Respond with up to 280 characters or a photo' },
                { icon: '🔥', text: 'Build a streak — show up every day and watch it grow' },
                { icon: '🔒', text: 'Your posts are private by default — share only if you choose' },
              ].map(({ icon, text }) => (
                <li key={text} className="flex items-start gap-4">
                  <span className="text-2xl leading-none mt-0.5" aria-hidden="true">{icon}</span>
                  <span className="text-gray-700 text-base leading-snug">{text}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Step 3 — Reminder */}
        {step === 3 && (
          <motion.div key="step3" {...slide} className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-1 tracking-tight">
                Set a reminder
              </h2>
              <p className="text-sm text-gray-500">
                We'll nudge you once a day if you haven't posted yet. You can change this any time.
              </p>
            </div>

            <fieldset>
              <legend className="sr-only">Choose a reminder time</legend>
              <div className="grid grid-cols-2 gap-2">
                {REMINDER_OPTIONS.map(({ label, value }) => (
                  <label
                    key={label}
                    className="flex items-center justify-center rounded-2xl py-3 px-4 text-sm font-medium cursor-pointer border-2 transition-colors"
                    style={{
                      borderColor: reminderValue === value ? '#2DBFA8' : 'transparent',
                      background: reminderValue === value ? '#E1F5EE' : '#fff',
                      color: reminderValue === value ? '#04342C' : '#6b7280',
                    }}
                  >
                    <input
                      type="radio"
                      name="reminder"
                      value={value ?? 'off'}
                      checked={reminderValue === value}
                      onChange={() => setReminderValue(value)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </motion.div>
        )}

        {/* Step 4 — Add to home screen */}
        {step === 4 && (
          <motion.div key="step4" {...slide} className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-1 tracking-tight">
                Add to your home screen
              </h2>
              <p className="text-sm text-gray-500">
                For the best experience, install the app so it's always one tap away.
              </p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl bg-white p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <span aria-hidden="true">🍎</span> iPhone
                </p>
                <ol className="text-sm text-gray-600 space-y-1 list-none">
                  <li>1. Open in <strong>Safari</strong></li>
                  <li>2. Tap the <strong>Share</strong> button <span className="text-gray-400">(box with arrow at the bottom)</span></li>
                  <li>3. Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                </ol>
              </div>
              <div className="rounded-2xl bg-white p-4 space-y-2">
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
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={next}
        disabled={saving}
        className="mt-8 w-full rounded-full py-4 text-sm font-medium text-white transition-transform active:scale-95 disabled:opacity-50"
        style={{ background: '#04342C' }}
      >
        {saving ? 'Saving…' : step < TOTAL_STEPS - 1 ? 'Next' : 'Get started'}
      </button>
    </div>
  )
}
