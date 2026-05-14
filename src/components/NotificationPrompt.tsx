import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isPushSupported, isIOS, isInstalledPWA, subscribeToPush } from '../lib/push'
import type { Palette } from '../lib/palette'

const DISMISSED_KEY = 'notifPromptDismissed'

interface Props {
  palette: Palette
  isFirstPost: boolean
}

export default function NotificationPrompt({ palette, isFirstPost }: Props) {
  const [visible, setVisible] = useState(() => {
    if (!isFirstPost) return false
    if (localStorage.getItem(DISMISSED_KEY)) return false
    return true
  })
  const [subscribing, setSubscribing] = useState(false)
  const [done, setDone] = useState(false)

  if (!visible || done) return null

  const ios = isIOS()
  const installed = isInstalledPWA()
  const supported = isPushSupported()

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  async function handleEnable() {
    setSubscribing(true)
    const { ok } = await subscribeToPush()
    setSubscribing(false)
    if (ok) {
      setDone(true)
      setVisible(false)
    }
    // If denied or failed, dismiss silently — Settings has the toggle
    dismiss()
  }

  // iOS not installed — can't use push, explain instead
  if (ios && !installed) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="rounded-3xl p-4 space-y-3"
          style={{ background: palette.surface }}
        >
          <p className="text-sm font-semibold" style={{ color: palette.accent }}>
            Get daily reminders
          </p>
          <p className="text-sm leading-relaxed" style={{ color: palette.accent, opacity: 0.8 }}>
            To receive notifications on iPhone, install this app first:
            tap the <strong>Share</strong> button in Safari, then choose <strong>Add to Home Screen</strong>.
          </p>
          <button
            onClick={dismiss}
            className="text-xs font-medium underline"
            style={{ color: palette.accent, opacity: 0.6 }}
          >
            Maybe later
          </button>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Push not supported at all (old browser etc.)
  if (!supported) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="rounded-3xl p-4 space-y-3"
        style={{ background: palette.surface }}
      >
        <p className="text-sm font-semibold" style={{ color: palette.accent }}>
          Want a gentle daily nudge?
        </p>
        <p className="text-sm leading-relaxed" style={{ color: palette.accent, opacity: 0.8 }}>
          We'll remind you once a day — only if you haven't posted yet.
        </p>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleEnable}
            disabled={subscribing}
            className="flex-1 rounded-full py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ background: palette.accent, color: palette.surface }}
          >
            {subscribing ? 'Enabling…' : 'Enable reminders'}
          </motion.button>
          <button
            onClick={dismiss}
            className="px-4 rounded-full text-sm font-medium border-2"
            style={{ borderColor: palette.accent, color: palette.accent }}
          >
            No thanks
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
