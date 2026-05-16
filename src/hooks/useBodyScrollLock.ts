import { useEffect } from 'react'

export function useBodyScrollLock() {
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    const prev = root.style.overflowY
    root.style.overflowY = 'hidden'
    return () => { root.style.overflowY = prev }
  }, [])
}
