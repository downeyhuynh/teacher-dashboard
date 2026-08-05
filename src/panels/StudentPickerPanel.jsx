import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SpinWheel } from '../components/students/SpinWheel'
import { useTools } from '../context/ToolsContext'
import { rosterToText } from '../utils/roster'
import { playSpinWheelSound } from '../utils/spinWheelSound'

const SPIN_DURATION_MS = 4200

/**
 * Random student selector with Hawaii / Caltech class rosters.
 */
export function StudentPickerPanel() {
  const { picker } = useTools()
  const {
    classOptions,
    activeClassId,
    activeRoster,
    pickedStudent,
    pickedHistory,
    avoidRepeats,
    selectClass,
    setClassRosterText,
    resolveNextPick,
    commitPick,
    pickStudentInstant,
    resetPicks,
    setAvoidRepeats,
  } = picker

  const [draftText, setDraftText] = useState(() => rosterToText(activeRoster))
  const [spinning, setSpinning] = useState(false)
  const [spinTargetIndex, setSpinTargetIndex] = useState(null)
  const [pendingWinner, setPendingWinner] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    setDraftText(rosterToText(activeRoster))
  }, [activeClassId, activeRoster])

  useEffect(() => {
    // Cancel an in-progress reveal if the class/roster changes.
    setSpinning(false)
    setSpinTargetIndex(null)
    setPendingWinner(null)
  }, [activeClassId])

  useEffect(() => {
    if (!isFullscreen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const activeLabel =
    classOptions.find((option) => option.id === activeClassId)?.label || 'Class'

  const saveRoster = () => {
    setClassRosterText(activeClassId, draftText)
  }

  const handleSpinEnd = useCallback(() => {
    if (pendingWinner) {
      commitPick(pendingWinner)
    }
    setSpinning(false)
    setPendingWinner(null)
    setSpinTargetIndex(null)
  }, [commitPick, pendingWinner])

  const spinWheel = () => {
    if (spinning || activeRoster.length === 0) return
    const next = resolveNextPick()
    if (!next) return

    setPendingWinner(next.name)
    setSpinTargetIndex(next.index)
    setSpinning(true)
    playSpinWheelSound(SPIN_DURATION_MS).catch(() => {
      // Ignore audio unlock / unsupported-browser failures.
    })
  }

  const instantChoose = () => {
    if (spinning) return
    pickStudentInstant()
  }

  const busy = spinning

  const panel = (
    <div className={`student-picker-panel ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <div className="student-picker-panel__topbar">
        <div className="timer-panel__modes" role="tablist" aria-label="Class">
          {classOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              role="tab"
              className={`tool-chip ${activeClassId === option.id ? 'is-active' : ''}`}
              aria-selected={activeClassId === option.id}
              disabled={busy}
              onClick={() => selectClass(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="stage-button"
          onClick={() => setIsFullscreen((value) => !value)}
        >
          {isFullscreen ? 'Exit full screen' : 'Full screen'}
        </button>
      </div>

      <SpinWheel
        names={activeRoster}
        targetIndex={spinTargetIndex}
        spinning={spinning}
        durationMs={SPIN_DURATION_MS}
        onSpinEnd={handleSpinEnd}
        onSpinRequest={spinWheel}
        labelMode={isFullscreen ? 'initials' : 'auto'}
        size={isFullscreen ? 'large' : 'default'}
      />

      <div className="student-picker-panel__result" aria-live="polite">
        {spinning ? (
          <span className="student-picker-panel__result-empty">Spinning…</span>
        ) : pickedStudent ? (
          <>
            <span className="student-picker-panel__result-label">Selected</span>
            <strong className="student-picker-panel__result-name">{pickedStudent}</strong>
          </>
        ) : (
          <span className="student-picker-panel__result-empty">
            {isFullscreen
              ? `Tap the wheel to pick from ${activeLabel}`
              : `Pick a student from ${activeLabel}`}
          </span>
        )}
      </div>

      <div className="student-picker-panel__actions">
        <button
          type="button"
          className="stage-button stage-button--primary"
          onClick={spinWheel}
          disabled={busy || activeRoster.length === 0}
        >
          Spin the wheel
        </button>
        <button
          type="button"
          className="stage-button"
          onClick={instantChoose}
          disabled={busy || activeRoster.length === 0}
        >
          Instant choose
        </button>
      </div>

      <button
        type="button"
        className="stage-button"
        onClick={resetPicks}
        disabled={busy}
      >
        Reset picks
      </button>

      <label className="student-picker-panel__toggle">
        <input
          type="checkbox"
          checked={avoidRepeats}
          disabled={busy}
          onChange={(event) => setAvoidRepeats(event.target.checked)}
        />
        <span>Avoid repeats until everyone is picked</span>
      </label>

      {pickedHistory.length > 0 && (
        <p className="student-picker-panel__history">
          Picked this round: {pickedHistory.join(', ')}
        </p>
      )}

      <div className="tool-panel__section student-picker-panel__settings">
        <label className="tool-panel__label" htmlFor="roster-editor">
          {activeLabel} roster ({activeRoster.length})
        </label>
        <textarea
          id="roster-editor"
          className="student-picker-panel__textarea"
          value={draftText}
          rows={6}
          placeholder={'One student per line\nAlex\nJordan\nSam'}
          disabled={busy}
          onChange={(event) => setDraftText(event.target.value)}
          onBlur={saveRoster}
        />
        <button type="button" className="stage-button" onClick={saveRoster} disabled={busy}>
          Save list
        </button>
      </div>
    </div>
  )

  if (isFullscreen) {
    return createPortal(
      <div className="student-picker-fullscreen-root">{panel}</div>,
      document.body,
    )
  }

  return panel
}
