import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTools } from '../context/ToolsContext'
import { usePortalRoot } from '../hooks/usePortalRoot'
import {
  OVERTIME_CLOCKS,
  createEmptyOvertimeClock,
} from '../utils/overtimeClocks'

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) return `${hours}:${mm}:${ss}`
  return `${minutes}:${ss}`
}

/**
 * Compact overtime HUD: time-only until hovered, then full controls.
 * Start / Pay expands the clock to a full-screen display.
 */
export function OvertimePanel() {
  const { overtime } = useTools()
  const portalRoot = usePortalRoot()
  const {
    clocks,
    volume,
    start,
    pay,
    pause,
    reset,
    adjustSeconds,
    setVolume,
  } = overtime

  const [clockId, setClockId] = useState(OVERTIME_CLOCKS[0].id)
  const [stageOpen, setStageOpen] = useState(false)
  const activeMeta =
    OVERTIME_CLOCKS.find((clock) => clock.id === clockId) || OVERTIME_CLOCKS[0]
  const clock = clocks[clockId] || createEmptyOvertimeClock()
  const { elapsedMs, running, mode } = clock
  const paying = running && mode === 'pay'
  const title = activeMeta.label

  useEffect(() => {
    if (!stageOpen) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setStageOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stageOpen])

  useEffect(() => {
    if (!running) setStageOpen(false)
  }, [running])

  const begin = () => {
    start(clockId)
    setStageOpen(true)
  }

  const beginPay = () => {
    pay(clockId)
    setStageOpen(true)
  }

  const stop = () => {
    pause(clockId)
    setStageOpen(false)
  }

  const clear = () => {
    reset(clockId)
    setStageOpen(false)
  }

  const controls = (
    <>
      <div
        className="overtime-panel__tabs"
        role="tablist"
        aria-label="Overtime clocks"
      >
        {OVERTIME_CLOCKS.map((entry) => {
          const entryClock = clocks[entry.id] || createEmptyOvertimeClock()
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              className={`overtime-panel__tab ${
                clockId === entry.id ? 'is-active' : ''
              } ${entryClock.running ? 'is-live' : ''}`}
              aria-selected={clockId === entry.id}
              onClick={() => setClockId(entry.id)}
            >
              {entry.shortLabel}
            </button>
          )
        })}
      </div>

      <div className="overtime-panel__label">
        {paying ? `${title} · paying` : title}
      </div>

      <div
        className="overtime-panel__adjust"
        role="group"
        aria-label={`Adjust ${title}`}
      >
        <button
          type="button"
          className="stage-button overtime-panel__adjust-btn"
          onClick={() => adjustSeconds(clockId, -5)}
          disabled={elapsedMs <= 0}
          title="Subtract 5 seconds"
        >
          −5s
        </button>
        <button
          type="button"
          className="stage-button overtime-panel__adjust-btn"
          onClick={() => adjustSeconds(clockId, 5)}
          title="Add 5 seconds"
        >
          +5s
        </button>
      </div>

      <label className="overtime-panel__volume">
        <span>Tick volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((volume ?? 0.75) * 100)}
          aria-label={`${title} tick volume`}
          onChange={(event) => setVolume(Number(event.target.value) / 100)}
        />
      </label>

      <div className="overtime-panel__actions">
        {running ? (
          <button type="button" className="stage-button" onClick={stop}>
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="stage-button stage-button--primary"
            onClick={begin}
          >
            {elapsedMs > 0 ? 'Resume' : 'Start'}
          </button>
        )}
        <button
          type="button"
          className={`stage-button ${paying ? 'is-active' : ''}`}
          onClick={beginPay}
          disabled={elapsedMs <= 0}
          title="Count overtime back down toward zero"
        >
          Pay
        </button>
        <button
          type="button"
          className="stage-button"
          onClick={clear}
          disabled={elapsedMs <= 0 && !running}
        >
          Reset
        </button>
      </div>
    </>
  )

  const hud = (
    <div
      className={`overtime-panel overtime-panel--${clockId} ${
        running ? 'is-running' : ''
      } ${paying ? 'is-paying' : ''} ${
        elapsedMs > 0 && !running ? 'is-paused' : ''
      }`}
    >
      <div className="overtime-panel__display" aria-live="polite">
        {formatElapsed(elapsedMs)}
      </div>
      <div className="overtime-panel__controls">{controls}</div>
    </div>
  )

  const stage =
    stageOpen && portalRoot
      ? createPortal(
          <div
            className={`overtime-stage ${paying ? 'is-paying' : ''}`}
            role="dialog"
            aria-label={`${title} overtime`}
          >
            <button
              type="button"
              className="overtime-stage__shrink"
              onClick={() => setStageOpen(false)}
            >
              Shrink
            </button>
            <div className="overtime-stage__clock">
              <div className="overtime-stage__label">
                {paying ? `${title} · paying` : title}
              </div>
              <div className="overtime-stage__time" aria-live="polite">
                {formatElapsed(elapsedMs)}
              </div>
            </div>
            <div className="overtime-stage__controls">{controls}</div>
          </div>,
          portalRoot,
        )
      : null

  return (
    <>
      {hud}
      {stage}
    </>
  )
}
