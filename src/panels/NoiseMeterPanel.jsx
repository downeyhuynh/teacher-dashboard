import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNoiseMeter } from '../hooks/useNoiseMeter'
import { usePortalRoot } from '../hooks/usePortalRoot'
import { noiseStatusLabel } from '../utils/noiseMeter'

function formatSeconds(ms) {
  return (Math.max(0, ms) / 1000).toFixed(1)
}

function NoiseMeterBar({
  level,
  status,
  warningThreshold,
  tooLoudThreshold,
  large = false,
}) {
  const meterPercent = Math.round(level)

  return (
    <div
      className={`noise-meter__bar-wrap ${large ? 'noise-meter__bar-wrap--large' : ''}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={meterPercent}
      aria-label="Classroom noise level"
    >
      <div className="noise-meter__bar-track">
        <div
          className={`noise-meter__bar-fill noise-meter__bar-fill--${status}`}
          style={{ width: `${meterPercent}%` }}
        />
        <span
          className="noise-meter__bar-mark noise-meter__bar-mark--warning"
          style={{ left: `${warningThreshold}%` }}
          title="Warning"
        />
        <span
          className="noise-meter__bar-mark noise-meter__bar-mark--loud"
          style={{ left: `${tooLoudThreshold}%` }}
          title="Too loud"
        />
      </div>
      <span className="noise-meter__bar-value">{meterPercent}</span>
    </div>
  )
}

/**
 * Live classroom noise meter — compact bottom level meter + student view.
 */
export function NoiseMeterPanel() {
  const meter = useNoiseMeter()
  const portalRoot = usePortalRoot()
  const [studentView, setStudentView] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (!studentView) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setStudentView(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [studentView])

  const label = noiseStatusLabel(meter.status)

  const panel = (
    <div
      className={`noise-meter noise-meter--${meter.status} ${
        studentView ? 'is-student-view' : 'is-dock'
      }`}
    >
      {studentView ? (
        <>
          <div className="noise-meter__status" aria-live="polite">
            {label}
          </div>
          <NoiseMeterBar
            level={meter.level}
            status={meter.status}
            warningThreshold={meter.settings.warningThreshold}
            tooLoudThreshold={meter.settings.tooLoudThreshold}
            large
          />
          {meter.countdownMs > 0 && (
            <div className="noise-meter__countdown" aria-live="assertive">
              Too loud for {formatSeconds(meter.countdownMs)}s
            </div>
          )}
          <div className="noise-meter__strikes">
            Strikes: {meter.strikes} / {meter.settings.maxStrikes}
          </div>
          {!meter.listening && (
            <p className="noise-meter__idle-hint">Microphone is off</p>
          )}
          <button
            type="button"
            className="stage-button noise-meter__exit-student"
            onClick={() => setStudentView(false)}
          >
            Exit Student View
          </button>
        </>
      ) : (
        <>
          <div className="noise-meter__dock-row">
            <div className="noise-meter__status noise-meter__status--compact">
              {label}
            </div>
            <div className="noise-meter__strikes noise-meter__strikes--compact">
              {meter.strikes}/{meter.settings.maxStrikes}
            </div>
            {meter.countdownMs > 0 && (
              <div className="noise-meter__countdown noise-meter__countdown--compact">
                {formatSeconds(meter.countdownMs)}s
              </div>
            )}
          </div>

          <NoiseMeterBar
            level={meter.level}
            status={meter.status}
            warningThreshold={meter.settings.warningThreshold}
            tooLoudThreshold={meter.settings.tooLoudThreshold}
          />

          <div className="noise-meter__actions noise-meter__actions--dock">
            {meter.listening ? (
              <button
                type="button"
                className="stage-button"
                onClick={meter.stopMicrophone}
              >
                Stop Mic
              </button>
            ) : (
              <button
                type="button"
                className="stage-button stage-button--primary"
                onClick={meter.startMicrophone}
              >
                Start Mic
              </button>
            )}
            <button
              type="button"
              className={`stage-button ${showSettings ? 'is-active' : ''}`}
              onClick={() => setShowSettings((value) => !value)}
              aria-expanded={showSettings}
            >
              Settings
            </button>
            <button
              type="button"
              className="stage-button"
              onClick={() => setStudentView(true)}
            >
              Student
            </button>
          </div>

          {meter.micError && (
            <p className="noise-meter__error" role="alert">
              {meter.micError}
            </p>
          )}

          {showSettings &&
            (portalRoot
              ? createPortal(
                  <div
                    className="noise-meter-settings-sheet"
                    onClick={(event) => {
                      if (event.target === event.currentTarget) {
                        setShowSettings(false)
                      }
                    }}
                  >
                    <div className="noise-meter-settings-sheet__card noise-meter__settings">
                      <div className="noise-meter-settings-sheet__head">
                        <strong>Noise Meter Settings</strong>
                        <button
                          type="button"
                          className="stage-button"
                          onClick={() => setShowSettings(false)}
                        >
                          Done
                        </button>
                      </div>

                      <div className="tool-panel__section">
                        <button
                          type="button"
                          className="stage-button"
                          onClick={meter.startCalibration}
                          disabled={!meter.listening || meter.calibrating}
                        >
                          {meter.calibrating
                            ? `Calibrating… ${Math.round(meter.calibrateProgress * 100)}%`
                            : 'Calibrate Classroom'}
                        </button>
                        {meter.lastCalibrationNote && (
                          <p className="noise-meter__note">
                            {meter.lastCalibrationNote}
                          </p>
                        )}
                      </div>

                      <div className="tool-panel__section">
                        <label className="tool-panel__label" htmlFor="noise-warning">
                          Warning ({meter.settings.warningThreshold})
                        </label>
                        <input
                          id="noise-warning"
                          type="range"
                          min={5}
                          max={90}
                          value={meter.settings.warningThreshold}
                          onChange={(event) =>
                            meter.updateSettings({
                              warningThreshold: Number(event.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="tool-panel__section">
                        <label className="tool-panel__label" htmlFor="noise-loud">
                          Too loud ({meter.settings.tooLoudThreshold})
                        </label>
                        <input
                          id="noise-loud"
                          type="range"
                          min={10}
                          max={98}
                          value={meter.settings.tooLoudThreshold}
                          onChange={(event) =>
                            meter.updateSettings({
                              tooLoudThreshold: Number(event.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="tool-panel__section">
                        <label
                          className="tool-panel__label"
                          htmlFor="noise-sensitivity"
                        >
                          Sensitivity ({meter.settings.sensitivity.toFixed(1)}×)
                        </label>
                        <input
                          id="noise-sensitivity"
                          type="range"
                          min={0.4}
                          max={2.5}
                          step={0.1}
                          value={meter.settings.sensitivity}
                          onChange={(event) =>
                            meter.updateSettings({
                              sensitivity: Number(event.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="tool-panel__section">
                        <label className="tool-panel__label" htmlFor="noise-hold">
                          Hold before strike ({meter.settings.holdSeconds}s)
                        </label>
                        <input
                          id="noise-hold"
                          type="range"
                          min={1}
                          max={30}
                          step={1}
                          value={meter.settings.holdSeconds}
                          onChange={(event) =>
                            meter.updateSettings({
                              holdSeconds: Number(event.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="tool-panel__section">
                        <label
                          className="tool-panel__label"
                          htmlFor="noise-max-strikes"
                        >
                          Max strikes ({meter.settings.maxStrikes})
                        </label>
                        <input
                          id="noise-max-strikes"
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={meter.settings.maxStrikes}
                          onChange={(event) =>
                            meter.updateSettings({
                              maxStrikes: Number(event.target.value),
                            })
                          }
                        />
                      </div>

                      <label className="noise-meter__toggle">
                        <input
                          type="checkbox"
                          checked={meter.settings.soundAlert}
                          onChange={(event) =>
                            meter.updateSettings({
                              soundAlert: event.target.checked,
                            })
                          }
                        />
                        <span>Sound Alert</span>
                      </label>

                      <div className="noise-meter__actions">
                        <button
                          type="button"
                          className="stage-button"
                          onClick={meter.undoStrike}
                          disabled={meter.strikes <= 0}
                        >
                          Undo Strike
                        </button>
                        <button
                          type="button"
                          className="stage-button"
                          onClick={meter.resetStrikes}
                          disabled={
                            meter.strikes <= 0 && meter.countdownMs <= 0
                          }
                        >
                          Reset Strikes
                        </button>
                      </div>

                      {meter.cooldownMs > 0 && (
                        <p className="noise-meter__note">
                          Cooldown: {formatSeconds(meter.cooldownMs)}s
                        </p>
                      )}

                      <p className="noise-meter__privacy">
                        Audio is analyzed locally and is not recorded.
                      </p>
                    </div>
                  </div>,
                  portalRoot,
                )
              : null)}
        </>
      )}
    </div>
  )

  if (studentView && portalRoot) {
    return createPortal(
      <div className="noise-meter-student-root">{panel}</div>,
      portalRoot,
    )
  }

  return panel
}
