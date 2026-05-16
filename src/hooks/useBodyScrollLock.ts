import { useEffect } from 'react'

// iOS scrolls background containers when a textarea inside a fixed modal
// gains focus. We attach a scroll listener that immediately resets scrollTop
// back to the saved value for the lifetime of the modal, then clean up.
export function useBodyScrollLock() {
  useEffect(() => {
    const els = [
      document.getElementById('root'),
      document.querySelector('main'),
    ].filter((el): el is HTMLElement => el !== null)

    const saved = els.map(el => ({ el, scrollTop: el.scrollTop }))

    function cancelScroll({ el, scrollTop }: { el: HTMLElement; scrollTop: number }) {
      el.scrollTop = scrollTop
    }

    const handlers = saved.map(entry => {
      const handler = () => cancelScroll(entry)
      entry.el.addEventListener('scroll', handler, { passive: true })
      return { el: entry.el, handler }
    })

    return () => {
      handlers.forEach(({ el, handler }) => el.removeEventListener('scroll', handler))
      saved.forEach(({ el, scrollTop }) => { el.scrollTop = scrollTop })
    }
  }, [])
}
