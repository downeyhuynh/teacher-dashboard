/**
 * Noise meter settings helpers + gentle strike alert.
 * Audio analysis stays in the browser; nothing is uploaded.
 */

export const NOISE_METER_STORAGE_KEY = 'teacher-dashboard.noise-meter.settings.v1'

export const DEFAULT_NOISE_METER_SETTINGS = {
  warningThreshold: 45,
  tooLoudThreshold: 65,
  sensitivity: 1,
  holdSeconds: 5,
  maxStrikes: 3,
  soundAlert: true,
}

const COOLDOWN_MS = 8_000

export function getStrikeCooldownMs() {
  return COOLDOWN_MS
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function loadNoiseMeterSettings() {
  try {
    const raw = localStorage.getItem(NOISE_METER_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_NOISE_METER_SETTINGS }
    const parsed = JSON.parse(raw)
    return {
      warningThreshold: clamp(Number(parsed.warningThreshold) || 45, 5, 95),
      tooLoudThreshold: clamp(Number(parsed.tooLoudThreshold) || 65, 10, 98),
      sensitivity: clamp(Number(parsed.sensitivity) || 1, 0.4, 2.5),
      holdSeconds: clamp(Number(parsed.holdSeconds) || 5, 1, 30),
      maxStrikes: clamp(Math.round(Number(parsed.maxStrikes) || 3), 1, 10),
      soundAlert: parsed.soundAlert !== false,
    }
  } catch {
    return { ...DEFAULT_NOISE_METER_SETTINGS }
  }
}

export function saveNoiseMeterSettings(settings) {
  try {
    localStorage.setItem(NOISE_METER_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore quota / private mode failures.
  }
}

/**
 * @param {number} level 0–100 smoothed relative loudness
 * @param {{ warningThreshold: number, tooLoudThreshold: number }} settings
 */
export function getNoiseStatus(level, settings) {
  if (level >= settings.tooLoudThreshold) return 'too-loud'
  if (level >= settings.warningThreshold) return 'warning'
  return 'good'
}

export function noiseStatusLabel(status) {
  if (status === 'too-loud') return 'TOO LOUD'
  if (status === 'warning') return 'WARNING'
  return 'GOOD'
}

/**
 * Suggest thresholds from a calibration baseline (typical room average 0–100).
 */
export function suggestThresholdsFromBaseline(baseline) {
  const base = clamp(baseline, 5, 70)
  const warning = clamp(Math.round(base + 12), 15, 85)
  const tooLoud = clamp(Math.round(base + 28), warning + 8, 95)
  return { warningThreshold: warning, tooLoudThreshold: tooLoud }
}

let alertContext = null

function getAlertContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!alertContext) alertContext = new AudioCtx()
  return alertContext
}

/** Soft two-tone chime — one short notification, not a continuous beep. */
export async function playStrikeAlert() {
  const ctx = getAlertContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      return
    }
  }

  const now = ctx.currentTime
  const notes = [
    { freq: 523.25, delay: 0, vel: 0.12 },
    { freq: 659.25, delay: 0.12, vel: 0.1 },
  ]

  for (const note of notes) {
    const start = now + note.delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(note.freq, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(note.vel, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.5)
  }
}
