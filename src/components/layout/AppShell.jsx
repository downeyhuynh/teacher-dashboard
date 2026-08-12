import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PresentationStage } from './PresentationStage'
import { ToolToolbar } from './ToolToolbar'
import { FloatingPanel } from '../ui/FloatingPanel'
import { useFloatingPanels } from '../../hooks/useFloatingPanels'
import { usePresentation } from '../../context/PresentationContext'
import { useTools } from '../../context/ToolsContext'
import {
  PANEL_REGISTRY_BY_ID,
  REGISTERED_PANEL_IDS,
  MAIN_TOOLBAR_TOOLS,
  QUICK_TOOLBAR_TOOLS,
} from '../../panels/panelRegistry'
import { PANEL_DEFAULT_SIZES, PANEL_IDS } from '../../utils/panelDefaults'

const CORNER_MARGIN = 16
const TIMER_RUN_SIZE = { width: 168, height: 148 }
const EDGE_PX = 28
const HIDE_DELAY_MS = 420

function getCornerPosition(corner, size, bounds) {
  const width = bounds?.width ?? window.innerWidth
  const height = bounds?.height ?? window.innerHeight
  const rightX = Math.max(CORNER_MARGIN, width - size.width - CORNER_MARGIN)
  const bottomY = Math.max(CORNER_MARGIN, height - size.height - CORNER_MARGIN)
  const midY = Math.max(CORNER_MARGIN, Math.round((height - size.height) / 2))

  switch (corner) {
    case 'top-right':
      return { x: rightX, y: CORNER_MARGIN }
    case 'mid-right':
      return { x: rightX, y: midY }
    case 'bottom-left':
      return { x: CORNER_MARGIN, y: bottomY }
    case 'top-left':
      return { x: CORNER_MARGIN, y: CORNER_MARGIN }
    case 'bottom-right':
    default:
      return { x: rightX, y: bottomY }
  }
}

/**
 * Application chrome: presentation stage, tool rail, and floating panels.
 */
export function AppShell() {
  const shellRef = useRef(null)
  const panelLayerRef = useRef(null)
  const hideTopTimerRef = useRef(null)
  const hideRightTimerRef = useRef(null)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [revealTop, setRevealTop] = useState(false)
  const [revealRight, setRevealRight] = useState(false)

  const {
    annotateEnabled,
    toggleAnnotateEnabled,
    enableAnnotate,
    resetSlideView,
  } = usePresentation()
  const { timer } = useTools()

  const {
    panels,
    openPanels,
    focusedId,
    togglePanel,
    openPanel,
    closePanel,
    minimizePanel,
    restorePanel,
    bringToFront,
    setPanelPosition,
    setPanelSize,
  } = useFloatingPanels(REGISTERED_PANEL_IDS)

  const activeIds = useMemo(() => {
    const ids = new Set()
    for (const panel of openPanels) {
      if (panel.id === PANEL_IDS.ANNOTATE) continue
      ids.add(panel.id)
    }
    if (annotateEnabled) ids.add(PANEL_IDS.ANNOTATE)
    return ids
  }, [annotateEnabled, openPanels])

  const clearHideTimers = useCallback(() => {
    if (hideTopTimerRef.current) {
      window.clearTimeout(hideTopTimerRef.current)
      hideTopTimerRef.current = null
    }
    if (hideRightTimerRef.current) {
      window.clearTimeout(hideRightTimerRef.current)
      hideRightTimerRef.current = null
    }
  }, [])

  const scheduleHideTop = useCallback(() => {
    if (hideTopTimerRef.current) window.clearTimeout(hideTopTimerRef.current)
    hideTopTimerRef.current = window.setTimeout(() => {
      setRevealTop(false)
    }, HIDE_DELAY_MS)
  }, [])

  const scheduleHideRight = useCallback(() => {
    if (hideRightTimerRef.current) window.clearTimeout(hideRightTimerRef.current)
    hideRightTimerRef.current = window.setTimeout(() => {
      setRevealRight(false)
    }, HIDE_DELAY_MS)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current
    if (!shell) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await shell.requestFullscreen()
      }
    } catch {
      // Fullscreen may be blocked by the browser.
    }
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === shellRef.current
      setIsFullscreen(active)
      setRevealTop(false)
      setRevealRight(false)
      if (active) {
        resetSlideView()
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [resetSlideView])

  useEffect(() => () => clearHideTimers(), [clearHideTimers])

  useEffect(() => {
    if (!isFullscreen) {
      clearHideTimers()
      setRevealTop(false)
      setRevealRight(false)
      return undefined
    }

    const onMove = (event) => {
      const shell = shellRef.current
      if (!shell) return
      const rect = shell.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      const nearTop = y <= EDGE_PX
      const nearRight = x >= rect.width - EDGE_PX

      if (nearTop) {
        if (hideTopTimerRef.current) window.clearTimeout(hideTopTimerRef.current)
        setRevealTop(true)
      } else if (!event.target?.closest?.('.slide-nav')) {
        scheduleHideTop()
      }

      if (nearRight) {
        if (hideRightTimerRef.current) {
          window.clearTimeout(hideRightTimerRef.current)
        }
        setRevealRight(true)
      } else if (!event.target?.closest?.('.tool-toolbar')) {
        scheduleHideRight()
      }
    }

    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [clearHideTimers, isFullscreen, scheduleHideRight, scheduleHideTop])

  const openAnnotatePanel = useCallback(() => {
    const panel = panels[PANEL_IDS.ANNOTATE]
    if (!panel) return
    if (!panel.isOpen) {
      openPanel(PANEL_IDS.ANNOTATE)
      return
    }
    if (panel.isMinimized) {
      restorePanel(PANEL_IDS.ANNOTATE)
      return
    }
    bringToFront(PANEL_IDS.ANNOTATE)
  }, [bringToFront, openPanel, panels, restorePanel])

  const openCornerPanel = useCallback(
    (id, corner = 'bottom-right') => {
      const size = PANEL_DEFAULT_SIZES[id]
      const bounds = panelLayerRef.current?.getBoundingClientRect()
      setPanelPosition(id, getCornerPosition(corner, size, bounds))
      openPanel(id)
    },
    [openPanel, setPanelPosition],
  )

  const timerPanelOpen = Boolean(panels[PANEL_IDS.TIMER]?.isOpen)
  useEffect(() => {
    if (!timerPanelOpen) return

    const bounds = panelLayerRef.current?.getBoundingClientRect()

    if (timer.compact) {
      setPanelSize(PANEL_IDS.TIMER, TIMER_RUN_SIZE)
      setPanelPosition(
        PANEL_IDS.TIMER,
        getCornerPosition('mid-right', TIMER_RUN_SIZE, bounds),
      )
      return
    }

    setPanelSize(PANEL_IDS.TIMER, PANEL_DEFAULT_SIZES[PANEL_IDS.TIMER])
  }, [setPanelPosition, setPanelSize, timer.compact, timerPanelOpen])

  const handleToolSelect = useCallback(
    (id) => {
      const entry = PANEL_REGISTRY_BY_ID[id]

      if (entry?.corner) {
        const panel = panels[id]
        if (panel?.isOpen) {
          closePanel(id)
          return
        }
        openCornerPanel(id, entry.corner)
        return
      }

      if (id !== PANEL_IDS.ANNOTATE) {
        togglePanel(id)
        return
      }

      if (!annotateEnabled) {
        enableAnnotate()
        openAnnotatePanel()
        return
      }

      toggleAnnotateEnabled()
    },
    [
      annotateEnabled,
      closePanel,
      enableAnnotate,
      openAnnotatePanel,
      openCornerPanel,
      panels,
      toggleAnnotateEnabled,
      togglePanel,
    ],
  )

  const requestAnnotate = useCallback(() => {
    enableAnnotate()
    openAnnotatePanel()
  }, [enableAnnotate, openAnnotatePanel])

  const shellClass = [
    'app-shell',
    isFullscreen ? 'is-fullscreen' : '',
    isFullscreen && revealTop ? 'is-reveal-top' : '',
    isFullscreen && revealRight ? 'is-reveal-right' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass} ref={shellRef}>
      <PresentationStage
        annotateActive={annotateEnabled}
        onRequestAnnotate={requestAnnotate}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      <div className="panel-layer" ref={panelLayerRef}>
        {openPanels.map((panel) => {
          const entry = PANEL_REGISTRY_BY_ID[panel.id]
          if (!entry) return null

          const PanelContent = entry.Component
          const timerRunningCompact =
            panel.id === PANEL_IDS.TIMER && timer.compact

          return (
            <FloatingPanel
              key={panel.id}
              id={panel.id}
              title={entry.label}
              position={panel.position}
              size={panel.size}
              zIndex={panel.zIndex}
              isMinimized={panel.isMinimized}
              isFocused={focusedId === panel.id}
              boundsRef={panelLayerRef}
              onFocus={bringToFront}
              onMinimize={minimizePanel}
              onRestore={restorePanel}
              onClose={closePanel}
              onPositionChange={setPanelPosition}
              onSizeChange={setPanelSize}
              compact={Boolean(entry.compact) || timerRunningCompact}
              hideMinimize={Boolean(entry.hideMinimize) || timerRunningCompact}
            >
              <PanelContent />
            </FloatingPanel>
          )
        })}
      </div>

      <ToolToolbar
        tools={MAIN_TOOLBAR_TOOLS}
        quickTools={QUICK_TOOLBAR_TOOLS}
        activeIds={activeIds}
        onToolSelect={handleToolSelect}
        onMouseEnter={() => {
          if (!isFullscreen) return
          if (hideRightTimerRef.current) {
            window.clearTimeout(hideRightTimerRef.current)
          }
          setRevealRight(true)
        }}
        onMouseLeave={() => {
          if (!isFullscreen) return
          scheduleHideRight()
        }}
      />

      {isFullscreen && (
        <>
          <div className="fs-edge fs-edge--top" aria-hidden="true" />
          <div className="fs-edge fs-edge--right" aria-hidden="true" />
        </>
      )}
    </div>
  )
}
