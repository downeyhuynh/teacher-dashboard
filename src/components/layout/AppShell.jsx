import { useCallback, useEffect, useMemo, useRef } from 'react'
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
  const panelLayerRef = useRef(null)
  const {
    annotateEnabled,
    toggleAnnotateEnabled,
    enableAnnotate,
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
      // Annotate highlight follows draw mode, not whether the settings panel is open.
      if (panel.id === PANEL_IDS.ANNOTATE) continue
      ids.add(panel.id)
    }
    if (annotateEnabled) ids.add(PANEL_IDS.ANNOTATE)
    return ids
  }, [annotateEnabled, openPanels])

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

  // Snap running timer to a compact widget on the right.
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

      // Annotate toolbar button toggles drawing on/off.
      // Settings panel can be closed/minimized without stopping ink.
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

  return (
    <div className="app-shell">
      <PresentationStage
        annotateActive={annotateEnabled}
        onRequestAnnotate={requestAnnotate}
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
      />
    </div>
  )
}
