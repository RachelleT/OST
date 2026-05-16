import { useEffect } from 'react'

// iOS scrolls background containers when an input inside a fixed modal is
// focused (keyboard appears). We listen to both scroll and visualViewport
// resize/scroll events and immediately reset scrollTop back to the saved value.
export function useBodyScrollLock() {
  useEffect(() => {
    const els = [
      document.getElementById('root'),
      document.querySelector('main'),
    ].filter((el): el is HTMLElement => el !== null)

    const saved = els.map(el => ({ el, scrollTop: el.scrollTop }))

    function restore() {
      saved.forEach(({ el, scrollTop }) => { el.scrollTop = scrollTop })
    }

    els.forEach(el => el.addEventListener('scroll', restore, { passive: true }))

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', restore)
      vv.addEventListener('scroll', restore)
    }

    return () => {
      els.forEach(el => el.removeEventListener('scroll', restore))
      if (vv) {
        vv.removeEventListener('resize', restore)
        vv.removeEventListener('scroll', restore)
      }
      restore()
    }
  }, [])
}
