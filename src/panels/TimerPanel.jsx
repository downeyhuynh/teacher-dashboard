import { useRef, useState } from 'react'
import { formatDuration } from '../utils/time'
import { useTools } from '../context/ToolsContext'

export function TimerPanel() {
  const { timer } = useTools()
  const fileInputRef = useRef(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)

  const displayMs = timer.mode === 'countdown' ? timer.remainingMs : timer.elapsedMs

  const onUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const isAudio =
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)

    if (!isAudio) {
      setUploadError('Please choose an audio file (MP3, WAV, etc.).')
      return
    }

    setUploading(true)
    setUploadError('')
    try {
      await timer.uploadFocusTrack(file)
    } catch (error) {
      setUploadError(error?.message || 'Could not save that audio file.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="timer-panel">
      <div className="timer-panel__modes" role="tablist" aria-label="Timer mode">
        <button
          type="button"
          role="tab"
          className={`tool-chip ${timer.mode === 'countdown' ? 'is-active' : ''}`}
          aria-selected={timer.mode === 'countdown'}
          onClick={() => timer.switchMode('countdown')}
        >
          Countdown
        </button>
        <button
          type="button"
          role="tab"
          className={`tool-chip ${timer.mode === 'stopwatch' ? 'is-active' : ''}`}
          aria-selected={timer.mode === 'stopwatch'}
          onClick={() => timer.switchMode('stopwatch')}
        >
          Stopwatch
        </button>
      </div>

      <div
        className={`timer-panel__display ${timer.finished ? 'is-finished' : ''} ${timer.running ? 'is-running' : ''}`}
        aria-live="polite"
      >
        {formatDuration(displayMs)}
      </div>

      {timer.mode === 'countdown' && (
        <div className="timer-panel__presets">
          {timer.presets.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={`tool-chip ${timer.durationMs === preset.ms ? 'is-active' : ''}`}
              onClick={() => timer.applyPreset(preset.ms)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {timer.mode === 'countdown' && (
        <label className="timer-panel__custom">
          <span>Custom (minutes)</span>
          <input
            type="number"
            min="1"
            max="180"
            defaultValue={Math.round(timer.durationMs / 60000)}
            onBlur={(event) => timer.setCustomDurationMinutes(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                timer.setCustomDurationMinutes(event.currentTarget.value)
              }
            }}
          />
        </label>
      )}

      <div className="tool-panel__section">
        <span className="tool-panel__label">Focus music</span>
        <label className="student-picker-panel__toggle">
          <input
            type="checkbox"
            checked={timer.focusMusicEnabled}
            onChange={(event) => timer.setFocusMusicEnabled(event.target.checked)}
          />
          <span>Play music while timer runs</span>
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
          className="timer-panel__file-input"
          onChange={onUpload}
        />

        <div className="timer-panel__actions">
          <button
            type="button"
            className="stage-button stage-button--primary"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Upload MP3'}
          </button>
          {timer.focusTrack && (
            <button
              type="button"
              className="stage-button stage-button--danger"
              onClick={() => timer.removeFocusTrack()}
            >
              Remove
            </button>
          )}
        </div>

        <p className="timer-panel__music-note">
          {timer.focusTrack
            ? `Using: ${timer.focusTrack.name}`
            : 'No upload yet — soft jazz will play by default.'}
        </p>

        {uploadError && <p className="timer-panel__upload-error">{uploadError}</p>}

        {timer.running && timer.focusMusicEnabled && (
          <p className="timer-panel__music-note">
            {timer.focusTrack ? 'Your track is playing' : 'Focus jazz is playing'}
          </p>
        )}
      </div>

      <div className="timer-panel__actions">
        {timer.running ? (
          <button type="button" className="stage-button stage-button--primary" onClick={timer.pause}>
            Pause
          </button>
        ) : (
          <button type="button" className="stage-button stage-button--primary" onClick={timer.start}>
            {timer.finished ? 'Restart' : 'Start'}
          </button>
        )}
        <button type="button" className="stage-button" onClick={timer.reset}>
          Reset
        </button>
      </div>

      {timer.finished && timer.mode === 'countdown' && (
        <p className="timer-panel__done">Time&apos;s up</p>
      )}
    </div>
  )
}
