import { useCallback, useMemo, useState } from 'react'
import {
  PANEL_DEFAULT_ORIGINS,
  PANEL_DEFAULT_SIZES,
} from '../utils/panelDefaults'

let zCounter = 10

function createPanelState(id) {
  const size = PANEL_DEFAULT_SIZES[id]
  const origin = PANEL_DEFAULT_ORIGINS[id]

  return {
    id,
    isOpen: false,
    isMinimized: false,
    position: { ...origin },
    size: { ...size },
    zIndex: 0,
  }
}

/**
 * Manages floating tool panel lifecycle:
 * open / close / toggle / minimize / restore / focus / move.
 *
 * Tool domain state (timer ticks, drawings, etc.) should live
 * separately so it survives minimize and can outlive UI chrome.
 */
export function useFloatingPanels(panelIds) {
  const [panels, setPanels] = useState(() => {
    const initial = {}
    for (const id of panelIds) {
      initial[id] = createPanelState(id)
    }
    return initial
  })

  const [focusedId, setFocusedId] = useState(null)

  const bringToFront = useCallback((id) => {
    zCounter += 1
    const nextZ = zCounter
    setPanels((prev) => ({
      ...prev,
      [id]: { ...prev[id], zIndex: nextZ },
    }))
    setFocusedId(id)
  }, [])

  const openPanel = useCallback(
    (id) => {
      setPanels((prev) => {
        const current = prev[id]
        if (!current) return prev
        if (current.isOpen) {
          return {
            ...prev,
            [id]: { ...current, isMinimized: false },
          }
        }
        zCounter += 1
        return {
          ...prev,
          [id]: {
            ...current,
            isOpen: true,
            isMinimized: false,
            zIndex: zCounter,
          },
        }
      })
      setFocusedId(id)
    },
    [],
  )

  const closePanel = useCallback((id) => {
    setPanels((prev) => {
      const current = prev[id]
      if (!current) return prev
      return {
        ...prev,
        [id]: { ...current, isOpen: false, isMinimized: false },
      }
    })
    setFocusedId((prev) => (prev === id ? null : prev))
  }, [])

  const minimizePanel = useCallback((id) => {
    setPanels((prev) => {
      const current = prev[id]
      if (!current?.isOpen) return prev
      return {
        ...prev,
        [id]: { ...current, isMinimized: true },
      }
    })
  }, [])

  const restorePanel = useCallback((id) => {
    setPanels((prev) => {
      const current = prev[id]
      if (!current?.isOpen) return prev
      zCounter += 1
      return {
        ...prev,
        [id]: { ...current, isMinimized: false, zIndex: zCounter },
      }
    })
    setFocusedId(id)
  }, [])

  const togglePanel = useCallback(
    (id) => {
      const current = panels[id]
      if (!current) return

      if (!current.isOpen) {
        openPanel(id)
        return
      }

      if (current.isMinimized) {
        restorePanel(id)
        return
      }

      closePanel(id)
    },
    [closePanel, openPanel, panels, restorePanel],
  )

  const setPanelPosition = useCallback((id, position) => {
    setPanels((prev) => {
      const current = prev[id]
      if (!current) return prev
      return {
        ...prev,
        [id]: { ...current, position },
      }
    })
  }, [])

  const openPanels = useMemo(
    () => panelIds.map((id) => panels[id]).filter((panel) => panel?.isOpen),
    [panelIds, panels],
  )

  return {
    panels,
    openPanels,
    focusedId,
    openPanel,
    closePanel,
    togglePanel,
    minimizePanel,
    restorePanel,
    bringToFront,
    setPanelPosition,
  }
}
