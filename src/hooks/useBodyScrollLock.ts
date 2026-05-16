import { useLayoutEffect } from 'react'

// iOS scrolls background containers when an input inside a fixed modal gains
// focus. useLayoutEffect captures scroll positions before the first paint so
// we have the correct baseline even if iOS scrolls before useEffect would fire.
// We also restore after a 350ms delay to catch the end of the keyboard animation.
export function useBodyScrollLock() {
  useLayoutEffect(() => {
    const els = [
      document.getElementById('root'),
      document.querySelector('main'),
    ].filter((el): el is HTMLElement => el !== null)

    const saved = els.map(el => ({ el, scrollTop: el.scrollTop }))

    function restore() {
      saved.forEach(({ el, scrollTop }) => { el.scrollTop = scrollTop })
    }

    // Cancel any scroll iOS induces on background elements
    els.forEach(el => el.addEventListener('scroll', restore, { passive: true }))

    // Also prevent window-level scroll iOS sometimes causes
    const lockWindow = () => { if (window.scrollY !== 0) window.scrollTo(0, 0) }
    window.addEventListener('scroll', lockWindow, { passive: true })

    // Restore again after keyboard finishes animating in (~300ms)
    const t = setTimeout(restore, 350)

    return () => {
      clearTimeout(t)
      els.forEach(el => el.removeEventListener('scroll', restore))
      window.removeEventListener('scroll', lockWindow)
      restore()
      // Restore again after keyboard finishes animating out
      setTimeout(restore, 350)
    }
  }, [])
}
