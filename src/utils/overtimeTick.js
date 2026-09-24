/**
 * Overtime stopwatch SFX: loud ticks + super-short positive/negative buzzes.
 *
 * Ticks are scheduled on the AudioContext clock. Audio is unlocked on user
 * gestures; the scheduler keeps trying to resume if the browser suspends it.
 */

let sharedContext = null
let tickSchedulerId = null
let nextTickTime = 0
let tickVolume = 0.75
let tickingActive = false
let visibilityHooked = false
const progressMarksByClock = new Map()

const TICK_INTERVAL_SEC = 1
const SCHEDULE_AHEAD_SEC = 0.25
const SCHEDULER_POLL_MS = 50

function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) {
    throw new Error('Web Audio is not supported in this browser')
  }
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new AudioCtx()
  }
  return sharedContext
}

function hookVisibilityResume() {
  if (visibilityHooked || typeof document === 'undefined') return
  visibilityHooked = true

  const tryResume = () => {
    if (!tickingActive) return
    try {
      const ctx = getAudioContext()
      if (ctx.state === 'suspended') {
        void ctx.resume().then(() => {
          if (!tickingActive) return
          // Resync so the next audible tick is immediate after wake.
          nextTickTime = Math.min(nextTickTime, ctx.currentTime)
          ensureSchedulerRunning()
        })
      } else {
        ensureSchedulerRunning()
      }
    } catch {
      // Ignore.
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryResume()
  })
  window.addEventListener('focus', tryResume)
  // Any click while overtime is running re-unlocks audio (page-refresh restore).
  document.addEventListener(
    'pointerdown',
    () => {
      if (!tickingActive) return
      unlockOvertimeAudio(tickVolume)
      void startOvertimeTicking({ volume: tickVolume })
    },
    true,
  )
}

/**
 * Resume audio during a user gesture so later ticks are allowed to play.
 * Safe to call repeatedly from Start / Pay / adjust clicks.
 */
export function unlockOvertimeAudio(volume = tickVolume) {
  tickVolume = Math.min(1, Math.max(0, Number(volume) || 0))
  hookVisibilityResume()
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    // Tiny silent blip during the gesture so Chrome marks the context as used.
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.00001, now)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.01)
  } catch {
    // Ignore missing Web Audio / transient failures.
  }
}

async function ensureRunningContext() {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // May still be suspended without a gesture.
    }
  }
  return ctx
}

function playBuzz(
  ctx,
  { startFreq, endFreq, duration, peak, type = 'square', when = null },
) {
  // Never schedule in the past — browsers often drop those nodes silently.
  const now = Math.max(ctx.currentTime, when == null ? ctx.currentTime : when)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(startFreq, now)
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(0.01, endFreq),
    now + duration,
  )
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.02)
}

function playClockTickAt(ctx, when, volume = tickVolume) {
  if (ctx.state !== 'running') return
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
    if (ctx.state !== 'running' && ctx.state !== 'suspended') return
    const peak = Math.max(0.0001, Math.min(1, volume) * 0.7)
    // If still suspended, resume is in flight — skip rather than silent fail forever.
    if (ctx.state !== 'running') return
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
    if (ctx.state !== 'running') return
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
    unlockOvertimeAudio(volume)
    const ctx = await ensureRunningContext()
    if (ctx.state !== 'running') return
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

export async function playNegativeAdjustBuzz(volume = tickVolume) {
  try {
    unlockOvertimeAudio(volume)
    const ctx = await ensureRunningContext()
    if (ctx.state !== 'running') return
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

function ensureSchedulerRunning() {
  if (!tickingActive) return
  if (tickSchedulerId != null) return
  tickSchedulerId = window.setTimeout(pumpTickSchedule, SCHEDULER_POLL_MS)
}

function pumpTickSchedule() {
  // Clear id first so ensureSchedulerRunning can restart after this pump.
  tickSchedulerId = null
  if (!tickingActive) return

  try {
    if (tickVolume <= 0.001) {
      ensureSchedulerRunning()
      return
    }

    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
      ensureSchedulerRunning()
      return
    }

    if (ctx.state !== 'running') {
      ensureSchedulerRunning()
      return
    }

    // Catch up if the tab was throttled so we don't burst many ticks at once.
    if (nextTickTime < ctx.currentTime - TICK_INTERVAL_SEC * 0.5) {
      nextTickTime = ctx.currentTime
    }

    while (nextTickTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      playClockTickAt(ctx, nextTickTime, tickVolume)
      nextTickTime += TICK_INTERVAL_SEC
    }
  } catch {
    // Ignore transient audio failures; keep the scheduler alive.
  }

  ensureSchedulerRunning()
}

/**
 * Start a steady 1 Hz lock/clock tick while overtime is running.
 * Idempotent — safe to call from both click handlers and effects.
 */
export async function startOvertimeTicking({ volume = tickVolume } = {}) {
  tickVolume = Math.min(1, Math.max(0, Number(volume) || 0))
  hookVisibilityResume()

  if (tickVolume <= 0.001) {
    stopOvertimeTicking()
    return
  }

  const alreadyActive = tickingActive
  tickingActive = true

  try {
    // Prefer a sync resume attempt (works when called from a click).
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        // Keep trying via the scheduler / next gesture.
      }
    }

    if (!tickingActive) return

    if (ctx.state === 'running') {
      if (!alreadyActive || nextTickTime <= ctx.currentTime) {
        playClockTickAt(ctx, ctx.currentTime, tickVolume)
        nextTickTime = ctx.currentTime + TICK_INTERVAL_SEC
      }
    } else {
      // Will play as soon as a gesture resumes the context.
      nextTickTime = 0
    }

    ensureSchedulerRunning()
  } catch {
    // Keep active so a later gesture / visibility resume can recover.
    ensureSchedulerRunning()
  }
}

export function stopOvertimeTicking() {
  tickingActive = false
  clearTickScheduler()
}
