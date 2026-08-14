import { useEffect, useState } from 'react'

/**
 * Portal host that stays visible during browser fullscreen.
 * When the app shell is fullscreen, portals must target that element
 * (not document.body) or they render off-screen / invisible.
 */
export function usePortalRoot() {
  const [root, setRoot] = useState(() =>
    typeof document === 'undefined'
      ? null
      : document.fullscreenElement || document.body,
  )

  useEffect(() => {
    const sync = () => {
      setRoot(document.fullscreenElement || document.body)
    }
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  return root
}
