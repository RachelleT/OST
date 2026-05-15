import { useState } from 'react'
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

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [reminderValue, setReminderValue] = useState<string | null>('20:00')

  async function next() {
    if (step < 2) { setStep(s => s + 1); return }

    // Save reminder time to DB
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ reminder_time: reminderValue })
        .eq('id', user.id)
    }
    onComplete()
  }

  return (
    <div className="min-h-full flex flex-col px-6 py-12" style={{ background: '#FAF5EC' }}>
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-10">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-colors"
            style={{ background: i === step ? '#2DBFA8' : '#d1d5db' }}
            aria-hidden="true"
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
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

        {step === 1 && (
          <motion.div key="step1" {...slide} className="flex-1 flex flex-col justify-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 tracking-tight">How it works</h2>
            <ul className="space-y-5">
              {[
                { icon: '🌅', text: 'One new prompt every day, chosen just for you' },
                { icon: '✏️', text: 'Respond with up to 280 characters or a photo' },
                { icon: '🔥', text: 'Build a streak — a grace day protects you if life gets busy' },
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

        {step === 2 && (
          <motion.div key="step2" {...slide} className="flex-1 flex flex-col justify-center space-y-6">
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
      </AnimatePresence>

      <button
        onClick={next}
        className="mt-8 w-full rounded-full py-4 text-sm font-medium text-white transition-transform active:scale-95"
        style={{ background: '#04342C' }}
      >
        {step < 2 ? 'Next' : 'Get started'}
      </button>
    </div>
  )
}
