import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../utils/time'

const BATHROOM_MS = 5 * 60_000

/**
 * Compact 5-minute bathroom pass countdown.
 * Starts automatically when the panel opens.
 */
export function BathroomPanel() {
  const [remainingMs, setRemainingMs] = useState(BATHROOM_MS)
  const [running, setRunning] = useState(true)
  const [finished, setFinished] = useState(false)
  const lastTickRef = useRef(null)

  useEffect(() => {
    if (!running) {
      lastTickRef.current = null
      return undefined
    }

    let frameId = 0
    const tick = (now) => {
      const last = lastTickRef.current ?? now
      const delta = now - last
      lastTickRef.current = now

      setRemainingMs((prev) => {
        const next = Math.max(0, prev - delta)
        if (next <= 0) {
          setRunning(false)
          setFinished(true)
        }
        return next
      })

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [running])

  const restart = () => {
    setRemainingMs(BATHROOM_MS)
    setFinished(false)
    setRunning(true)
    lastTickRef.current = null
  }

  const progress = 1 - remainingMs / BATHROOM_MS

  return (
    <div
      className={`bathroom-panel ${finished ? 'is-finished' : ''} ${running ? 'is-running' : ''}`}
    >
      <div className="bathroom-panel__display" aria-live="polite">
        {formatDuration(remainingMs)}
      </div>
      <div
        className="bathroom-panel__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="Bathroom time remaining"
      >
        <span
          className="bathroom-panel__fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <div className="bathroom-panel__actions">
        {running ? (
          <button
            type="button"
            className="stage-button"
            onClick={() => setRunning(false)}
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="stage-button stage-button--primary"
            onClick={() => {
              if (finished || remainingMs <= 0) restart()
              else setRunning(true)
            }}
          >
            {finished ? 'Restart' : 'Resume'}
          </button>
        )}
        <button type="button" className="stage-button" onClick={restart}>
          Reset
        </button>
      </div>
    </div>
  )
}
