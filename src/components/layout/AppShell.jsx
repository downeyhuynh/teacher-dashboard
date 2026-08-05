import { useMemo, useRef } from 'react'
import { PresentationStage } from './PresentationStage'
import { ToolToolbar } from './ToolToolbar'
import { FloatingPanel } from '../ui/FloatingPanel'
import { useFloatingPanels } from '../../hooks/useFloatingPanels'
import {
  PANEL_REGISTRY_BY_ID,
  REGISTERED_PANEL_IDS,
  MAIN_TOOLBAR_TOOLS,
  QUICK_TOOLBAR_TOOLS,
} from '../../panels/panelRegistry'
import { PANEL_IDS } from '../../utils/panelDefaults'

/**
 * Application chrome: presentation stage, tool rail, and floating panels.
 */
export function AppShell() {
  const panelLayerRef = useRef(null)

  const {
    panels,
    openPanels,
    focusedId,
    togglePanel,
    closePanel,
    minimizePanel,
    restorePanel,
    bringToFront,
    setPanelPosition,
  } = useFloatingPanels(REGISTERED_PANEL_IDS)

  const activeIds = useMemo(() => {
    const ids = new Set()
    for (const panel of openPanels) {
      ids.add(panel.id)
    }
    return ids
  }, [openPanels])

  const annotatePanel = panels[PANEL_IDS.ANNOTATE]
  const annotateActive = Boolean(annotatePanel?.isOpen && !annotatePanel?.isMinimized)

  return (
    <div className="app-shell">
      <PresentationStage annotateActive={annotateActive} />

      <div className="panel-layer" ref={panelLayerRef}>
        {openPanels.map((panel) => {
          const entry = PANEL_REGISTRY_BY_ID[panel.id]
          if (!entry) return null

          const PanelContent = entry.Component

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
        onToolSelect={togglePanel}
      />
    </div>
  )
}
