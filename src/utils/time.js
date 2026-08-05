/**
 * Format milliseconds as M:SS or H:MM:SS.
 */
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`
  }

  return `${minutes}:${ss}`
}

export const TIMER_PRESETS = [
  { id: '1m', label: '1 min', ms: 60_000 },
  { id: '2m', label: '2 min', ms: 120_000 },
  { id: '5m', label: '5 min', ms: 300_000 },
  { id: '10m', label: '10 min', ms: 600_000 },
  { id: '15m', label: '15 min', ms: 900_000 },
]
