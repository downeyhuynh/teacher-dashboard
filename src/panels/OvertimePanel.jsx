import { useTools } from '../context/ToolsContext'

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
 * Compact soccer overtime stopwatch with start / pay / pause / reset.
 */
export function OvertimePanel() {
  const { overtime } = useTools()
  const {
    elapsedMs,
    running,
    mode,
    volume,
    start,
    pay,
    pause,
    reset,
    setVolume,
  } = overtime

  const paying = running && mode === 'pay'

  return (
    <div
      className={`overtime-panel ${running ? 'is-running' : ''} ${
        paying ? 'is-paying' : ''
      } ${elapsedMs > 0 && !running ? 'is-paused' : ''}`}
    >
      <div className="overtime-panel__label">
        {paying ? 'Paying down' : 'Overtime'}
      </div>
      <div className="overtime-panel__display" aria-live="polite">
        {formatElapsed(elapsedMs)}
      </div>
      <label className="overtime-panel__volume">
        <span>Tick volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((volume ?? 0.55) * 100)}
          aria-label="Overtime tick volume"
          onChange={(event) => setVolume(Number(event.target.value) / 100)}
        />
      </label>
      <div className="overtime-panel__actions">
        {running ? (
          <button type="button" className="stage-button" onClick={pause}>
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="stage-button stage-button--primary"
            onClick={start}
          >
            {elapsedMs > 0 ? 'Resume' : 'Start'}
          </button>
        )}
        <button
          type="button"
          className={`stage-button ${paying ? 'is-active' : ''}`}
          onClick={pay}
          disabled={elapsedMs <= 0}
          title="Count overtime back down toward zero"
        >
          Pay
        </button>
        <button
          type="button"
          className="stage-button"
          onClick={reset}
          disabled={elapsedMs <= 0 && !running}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
