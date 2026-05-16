import { useEffect } from 'react'

// iOS scrolls scrollable containers behind fixed modals when an input is
// focused (keyboard appears). This saves their scroll position when the
// modal mounts and restores it when it unmounts — without touching
// overflow-y (which itself causes a jump).
export function useBodyScrollLock() {
  useEffect(() => {
    const els = [
      document.getElementById('root'),
      document.querySelector('main'),
    ].filter((el): el is HTMLElement => el !== null)

    const saved = els.map(el => ({ el, scrollTop: el.scrollTop }))

    return () => {
      saved.forEach(({ el, scrollTop }) => { el.scrollTop = scrollTop })
    }
  }, [])
}
