import { useEffect, useState } from 'react'
import {
  getNoiseLevel,
  loadNoiseLevel,
  NOISE_LEVELS,
  saveNoiseLevel,
} from '../utils/noiseLevel'

/**
 * Classroom noise meter: Library / Restaurant / Coffee shop.
 */
export function NoiseLevelPanel() {
  const [levelId, setLevelId] = useState(() => loadNoiseLevel())
  const active = getNoiseLevel(levelId)

  useEffect(() => {
    saveNoiseLevel(levelId)
  }, [levelId])

  return (
    <div className={`noise-panel noise-panel--level-${levelId}`}>
      <div className="noise-panel__display" aria-live="polite">
        <span className="noise-panel__number">{active.id}</span>
        <div className="noise-panel__copy">
          <strong className="noise-panel__theme">{active.theme}</strong>
          <span className="noise-panel__cue">{active.cue}</span>
          <span className="noise-panel__voice">{active.voice}</span>
        </div>
      </div>

      <div className="noise-panel__levels" role="group" aria-label="Noise levels">
        {NOISE_LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            className={`noise-panel__choice ${
              levelId === level.id ? 'is-active' : ''
            } noise-panel__choice--${level.id}`}
            aria-pressed={levelId === level.id}
            onClick={() => setLevelId(level.id)}
          >
            <span className="noise-panel__choice-num">{level.id}</span>
            <span className="noise-panel__choice-label">{level.theme}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
