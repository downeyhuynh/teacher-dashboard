/**
 * Synthesized ukulele-style attention strum (~3 seconds).
 * Uses Web Audio so no media assets are required.
 */

let sharedContext = null
let activeStopAt = 0

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

function pluckString(ctx, destination, frequency, startTime, duration, velocity = 0.28) {
  const stringGain = ctx.createGain()
  stringGain.connect(destination)
  stringGain.gain.setValueAtTime(0.0001, startTime)
  stringGain.gain.exponentialRampToValueAtTime(velocity, startTime + 0.012)
  stringGain.gain.exponentialRampToValueAtTime(velocity * 0.35, startTime + 0.45)
  stringGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  // Soft harmonic stack — closer to a nylon-string uke than a pure sine.
  const partials = [
    { ratio: 1, type: 'triangle', amp: 0.55 },
    { ratio: 2, type: 'sine', amp: 0.22 },
    { ratio: 3, type: 'sine', amp: 0.12 },
    { ratio: 4, type: 'sine', amp: 0.06 },
  ]

  for (const partial of partials) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = partial.type
    osc.frequency.setValueAtTime(frequency * partial.ratio, startTime)
    gain.gain.setValueAtTime(partial.amp, startTime)
    osc.connect(gain)
    gain.connect(stringGain)
    osc.start(startTime)
    osc.stop(startTime + duration + 0.05)
  }

  // Short noise burst for the pluck attack.
  const noiseDuration = 0.04
  const noiseBuffer = ctx.createBuffer(
    1,
    Math.max(1, Math.floor(ctx.sampleRate * noiseDuration)),
    ctx.sampleRate,
  )
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  }

  const noise = ctx.createBufferSource()
  const noiseFilter = ctx.createBiquadFilter()
  const noiseGain = ctx.createGain()
  noise.buffer = noiseBuffer
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.setValueAtTime(frequency * 2.2, startTime)
  noiseFilter.Q.setValueAtTime(1.2, startTime)
  noiseGain.gain.setValueAtTime(0.18, startTime)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noiseDuration)
  noise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(stringGain)
  noise.start(startTime)
  noise.stop(startTime + noiseDuration + 0.02)
}

/**
 * Play a down-strummed open ukulele chord (~3s ring).
 * Standard re-entrant tuning voicing: G4–C4–E4–A4.
 */
export async function playAttentionBell() {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }

  const now = ctx.currentTime
  // Avoid stacking overlapping strums if clicked rapidly.
  if (now < activeStopAt - 0.15) {
    return { durationMs: Math.max(0, (activeStopAt - now) * 1000) }
  }

  const master = ctx.createGain()
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.setValueAtTime(-18, now)
  compressor.knee.setValueAtTime(18, now)
  compressor.ratio.setValueAtTime(3, now)
  compressor.attack.setValueAtTime(0.01, now)
  compressor.release.setValueAtTime(0.25, now)

  master.gain.setValueAtTime(0.85, now)
  master.connect(compressor)
  compressor.connect(ctx.destination)

  // Classic uke open strings (Hz): G4, C4, E4, A4
  const strings = [392.0, 261.63, 329.63, 440.0]
  const strumGap = 0.048
  const ring = 3.05

  strings.forEach((frequency, index) => {
    const start = now + index * strumGap
    const velocity = 0.3 - index * 0.02
    pluckString(ctx, master, frequency, start, ring - index * strumGap, velocity)
  })

  // Soft second flourish after the initial strum for a fuller “come back” cue.
  const echoAt = now + 0.55
  ;[329.63, 392.0, 523.25].forEach((frequency, index) => {
    pluckString(
      ctx,
      master,
      frequency,
      echoAt + index * 0.04,
      2.4 - index * 0.04,
      0.14,
    )
  })

  activeStopAt = now + 3.1
  return { durationMs: 3100 }
}
