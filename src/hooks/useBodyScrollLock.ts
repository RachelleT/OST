import { useLayoutEffect } from 'react'

// Locks <main> overflow before the modal paints so iOS has no scroll
// container to move when the keyboard appears. Restores on unmount.
export function useBodyScrollLock() {
  useLayoutEffect(() => {
    const main = document.querySelector('main') as HTMLElement | null
    if (!main) return

    const scrollTop = main.scrollTop
    const prevOverflow = main.style.overflowY

    main.style.overflowY = 'hidden'
    // Restore scrollTop immediately in case hiding overflow reset it
    main.scrollTop = scrollTop

    return () => {
      main.style.overflowY = prevOverflow
      main.scrollTop = scrollTop
    }
  }, [])
}
