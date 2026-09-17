/**
 * Soft clock-tick SFX for the overtime stopwatch.
 */

let sharedContext = null
let tickTimerId = null
let tickVolume = 0.55

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

function playClockTick(ctx, volume = tickVolume) {
  const now = ctx.currentTime
  const peak = Math.max(0.0001, Math.min(1, volume) * 0.55)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(980, now)
  osc.frequency.exponentialRampToValueAtTime(620, now + 0.04)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.08)
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
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }

  stopOvertimeTicking()
  if (tickVolume <= 0.001) return

  playClockTick(ctx, tickVolume)
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
