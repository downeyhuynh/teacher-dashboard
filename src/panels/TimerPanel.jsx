import { useRef, useState } from 'react'
import { formatDuration } from '../utils/time'
import { useTools } from '../context/ToolsContext'
import { MusicOffIcon, NoiseIcon } from '../components/ui/icons'

function FocusMusicButton({ timer, fileInputRef, uploading, uploadError, onUpload }) {
  const trackLabel = timer.focusTrack?.name || 'Soft jazz (default)'
  const clickTimerRef = useRef(null)

  return (
    <div className="timer-panel__sound">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
        className="timer-panel__file-input"
        onChange={onUpload}
      />
      <button
        type="button"
        className={`timer-panel__sound-logo ${timer.focusMusicEnabled ? 'is-on' : ''}`}
        aria-label={
          timer.focusMusicEnabled
            ? `Focus music on (${trackLabel}). Click to mute, double-click to change track.`
            : `Focus music off (${trackLabel}). Click to unmute, double-click to change track.`
        }
        title={`${trackLabel}\nClick: mute/unmute · Double-click: change track`}
        disabled={uploading}
        onClick={() => {
          if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current)
            clickTimerRef.current = null
            fileInputRef.current?.click()
            return
          }
          clickTimerRef.current = setTimeout(() => {
            clickTimerRef.current = null
            timer.setFocusMusicEnabled(!timer.focusMusicEnabled)
          }, 220)
        }}
      >
        {timer.focusMusicEnabled ? <NoiseIcon /> : <MusicOffIcon />}
      </button>
      <label className="timer-panel__volume">
        <span>Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((timer.focusMusicVolume ?? 0.55) * 100)}
          aria-label="Focus music volume"
          onChange={(event) =>
            timer.setFocusMusicVolume(Number(event.target.value) / 100)
          }
        />
      </label>
      {uploadError && <p className="timer-panel__upload-error">{uploadError}</p>}
    </div>
  )
}

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
      timer.setFocusMusicEnabled(true)
    } catch (error) {
      setUploadError(error?.message || 'Could not save that audio file.')
    } finally {
      setUploading(false)
    }
  }

  if (timer.compact) {
    return (
      <div
        className={`timer-panel timer-panel--run ${timer.finished ? 'is-finished' : ''} ${
          timer.running ? 'is-running' : ''
        }`}
      >
        <button
          type="button"
          className="timer-panel__run-display"
          aria-live="polite"
          aria-label="Expand timer settings"
          title="Expand"
          onClick={timer.expand}
        >
          {formatDuration(displayMs)}
        </button>

        <div className="timer-panel__run-actions">
          <FocusMusicButton
            timer={timer}
            fileInputRef={fileInputRef}
            uploading={uploading}
            uploadError={uploadError}
            onUpload={onUpload}
          />
          {timer.running ? (
            <button
              type="button"
              className="stage-button stage-button--primary"
              onClick={timer.pause}
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              className="stage-button stage-button--primary"
              onClick={timer.start}
            >
              {timer.finished ? 'Restart' : 'Resume'}
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

      <FocusMusicButton
        timer={timer}
        fileInputRef={fileInputRef}
        uploading={uploading}
        uploadError={uploadError}
        onUpload={onUpload}
      />

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
