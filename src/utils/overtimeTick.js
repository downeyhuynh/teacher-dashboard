/**
 * Overtime stopwatch SFX: loud ticks + super-short positive/negative buzzes.
 */

let sharedContext = null
let tickTimerId = null
let tickVolume = 0.75
const progressMarksByClock = new Map()

function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) {
    throw new Error('Web Audio is not supported in this browser')
  }
  if (!sharedContext) {
    sharedContext = new AudioCtx()
  }
  return sharedContext
}

async function ensureRunningContext() {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  return ctx
}

function playBuzz(ctx, { startFreq, endFreq, duration, peak, type = 'square' }) {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(startFreq, now)
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.01)
}

function playClockTick(ctx, volume = tickVolume) {
  const peak = Math.max(0.0001, Math.min(1, volume) * 0.95)
  playBuzz(ctx, {
    startFreq: 1100,
    endFreq: 720,
    duration: 0.06,
    peak,
    type: 'square',
  })
}

/** Super-short positive buzz (upward). */
export function playPositiveBuzz(volume = tickVolume) {
  try {
    const ctx = getAudioContext()
    const peak = Math.max(0.0001, Math.min(1, volume) * 0.7)
    playBuzz(ctx, {
      startFreq: 640,
      endFreq: 980,
      duration: 0.07,
      peak,
      type: 'square',
    })
  } catch {
    // Ignore transient audio failures.
  }
}

/** Super-short negative buzz (downward). */
export function playNegativeBuzz(volume = tickVolume) {
  try {
    const ctx = getAudioContext()
    const peak = Math.max(0.0001, Math.min(1, volume) * 0.7)
    playBuzz(ctx, {
      startFreq: 280,
      endFreq: 120,
      duration: 0.08,
      peak,
      type: 'sawtooth',
    })
  } catch {
    // Ignore transient audio failures.
  }
}

export async function playPositiveAdjustBuzz(volume = tickVolume) {
  try {
    await ensureRunningContext()
    playPositiveBuzz(volume)
  } catch {
    // Ignore transient audio failures.
  }
}

export async function playNegativeAdjustBuzz(volume = tickVolume) {
  try {
    await ensureRunningContext()
    playNegativeBuzz(volume)
  } catch {
    // Ignore transient audio failures.
  }
}

/**
 * Fire a short positive buzz every 5 accrued seconds.
 */
export function maybePlayOvertimeProgressCues(
  elapsedMs,
  volume = tickVolume,
  clockId = 'default',
) {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000)
  const marks = progressMarksByClock.get(clockId) || { five: -1 }

  if (totalSeconds <= 0) {
    progressMarksByClock.set(clockId, { five: 0 })
    return
  }

  const fiveMark = Math.floor(totalSeconds / 5)
  if (fiveMark > marks.five && fiveMark > 0) {
    playPositiveBuzz(volume)
  }

  progressMarksByClock.set(clockId, {
    five: Math.max(marks.five, fiveMark),
  })
}

export function resetOvertimeProgressCueMarks(clockId = null) {
  if (clockId) {
    progressMarksByClock.set(clockId, { five: -1 })
    return
  }
  progressMarksByClock.clear()
}

export function setOvertimeTickVolume(volume) {
  tickVolume = Math.min(1, Math.max(0, Number(volume) || 0))
}

export function getOvertimeTickVolume() {
  return tickVolume
}

/**
 * Start a 1 Hz lock/clock tick while overtime is running.
 */
export async function startOvertimeTicking({ volume = tickVolume } = {}) {
  tickVolume = Math.min(1, Math.max(0, Number(volume) || 0))
  await ensureRunningContext()

  stopOvertimeTicking()
  if (tickVolume <= 0.001) return

  playClockTick(getAudioContext(), tickVolume)
  tickTimerId = window.setInterval(() => {
    try {
      if (tickVolume <= 0.001) return
      playClockTick(getAudioContext(), tickVolume)
    } catch {
      // Ignore transient audio failures.
    }
  }, 1000)
}

export function stopOvertimeTicking() {
  if (tickTimerId != null) {
    window.clearInterval(tickTimerId)
    tickTimerId = null
  }
}
