/**
 * Overtime stopwatch SFX: loud ticks + super-short positive/negative buzzes.
 *
 * Ticks are scheduled on the AudioContext clock (not setInterval) so timing
 * stays steady. Audio is unlocked on user gestures so the first tick plays.
 */

let sharedContext = null
let tickSchedulerId = null
let nextTickTime = 0
let tickVolume = 0.75
let tickingActive = false
const progressMarksByClock = new Map()

const TICK_INTERVAL_SEC = 1
const SCHEDULE_AHEAD_SEC = 0.12
const SCHEDULER_POLL_MS = 25

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

/**
 * Resume audio during a user gesture so later ticks are allowed to play.
 * Safe to call repeatedly from Start / Pay / adjust clicks.
 */
export function unlockOvertimeAudio(volume = tickVolume) {
  tickVolume = Math.min(1, Math.max(0, Number(volume) || 0))
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
  } catch {
    // Ignore missing Web Audio / transient failures.
  }
}

async function ensureRunningContext() {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  return ctx
}

function playBuzz(
  ctx,
  { startFreq, endFreq, duration, peak, type = 'square', when = null },
) {
  const now = when == null ? ctx.currentTime : when
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(startFreq, now)
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(0.01, endFreq),
    now + duration,
  )
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.01)
}

function playClockTickAt(ctx, when, volume = tickVolume) {
  const peak = Math.max(0.0001, Math.min(1, volume) * 0.95)
  playBuzz(ctx, {
    startFreq: 1100,
    endFreq: 720,
    duration: 0.06,
    peak,
    type: 'square',
    when,
  })
}

/** Super-short positive buzz (upward). */
export function playPositiveBuzz(volume = tickVolume) {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
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
    if (ctx.state === 'suspended') void ctx.resume()
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

function clearTickScheduler() {
  if (tickSchedulerId != null) {
    window.clearTimeout(tickSchedulerId)
    tickSchedulerId = null
  }
}

function pumpTickSchedule() {
  if (tickSchedulerId == null) return

  try {
    if (tickVolume <= 0.001) {
      tickSchedulerId = window.setTimeout(pumpTickSchedule, SCHEDULER_POLL_MS)
      return
    }

    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
      tickSchedulerId = window.setTimeout(pumpTickSchedule, SCHEDULER_POLL_MS)
      return
    }

    // Catch up if the tab was throttled so we don't burst many ticks at once.
    if (nextTickTime < ctx.currentTime - TICK_INTERVAL_SEC) {
      nextTickTime = ctx.currentTime
    }

    while (nextTickTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      playClockTickAt(ctx, nextTickTime, tickVolume)
      nextTickTime += TICK_INTERVAL_SEC
    }
  } catch {
    // Ignore transient audio failures; keep the scheduler alive.
  }

  tickSchedulerId = window.setTimeout(pumpTickSchedule, SCHEDULER_POLL_MS)
}

/**
 * Start a steady 1 Hz lock/clock tick while overtime is running.
 * Idempotent — safe to call from both click handlers and effects.
 */
export async function startOvertimeTicking({ volume = tickVolume } = {}) {
  tickVolume = Math.min(1, Math.max(0, Number(volume) || 0))

  if (tickVolume <= 0.001) {
    stopOvertimeTicking()
    return
  }

  // Already started (or starting) — just make sure the context is unmuted.
  if (tickingActive) {
    unlockOvertimeAudio(tickVolume)
    return
  }
  tickingActive = true

  try {
    const ctx = await ensureRunningContext()
    if (!tickingActive) return

    // Immediate first tick, then one per second on the audio clock.
    playClockTickAt(ctx, ctx.currentTime, tickVolume)
    nextTickTime = ctx.currentTime + TICK_INTERVAL_SEC
    if (tickSchedulerId == null) {
      tickSchedulerId = window.setTimeout(pumpTickSchedule, SCHEDULER_POLL_MS)
    }
  } catch {
    tickingActive = false
    clearTickScheduler()
  }
}

export function stopOvertimeTicking() {
  tickingActive = false
  clearTickScheduler()
}
