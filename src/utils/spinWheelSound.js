/**
 * Web Audio spin-wheel SFX — whoosh + ticks while spinning, ding on land.
 * No media assets required.
 */

let sharedContext = null

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

function playTick(ctx, destination, time, velocity = 0.12) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(880 + Math.random() * 220, time)
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(velocity, time + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
  osc.connect(gain)
  gain.connect(destination)
  osc.start(time)
  osc.stop(time + 0.06)
}

function playWhoosh(ctx, destination, startTime, duration) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }

  const noise = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  noise.buffer = buffer
  filter.type = 'bandpass'
  filter.Q.setValueAtTime(1.4, startTime)
  filter.frequency.setValueAtTime(320, startTime)
  filter.frequency.exponentialRampToValueAtTime(1400, startTime + duration * 0.45)
  filter.frequency.exponentialRampToValueAtTime(280, startTime + duration)

  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.08)
  gain.gain.setValueAtTime(0.16, startTime + duration * 0.55)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  noise.start(startTime)
  noise.stop(startTime + duration + 0.02)
}

function playLandDing(ctx, destination, time) {
  const notes = [
    { freq: 523.25, delay: 0, vel: 0.22 },
    { freq: 659.25, delay: 0.08, vel: 0.18 },
    { freq: 783.99, delay: 0.16, vel: 0.14 },
  ]

  for (const note of notes) {
    const start = time + note.delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(note.freq, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(note.vel, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55)
    osc.connect(gain)
    gain.connect(destination)
    osc.start(start)
    osc.stop(start + 0.6)
  }
}

/**
 * Play the spin whoosh + accelerating ticks for `durationMs`.
 * Returns a promise that resolves when the land ding finishes.
 */
export async function playSpinWheelSound(durationMs = 4200) {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }

  const now = ctx.currentTime
  const duration = Math.max(0.8, durationMs / 1000)

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.9, now)
  master.connect(ctx.destination)

  playWhoosh(ctx, master, now, duration)

  // Ticks that get closer together as the wheel “slows”.
  let t = now + 0.12
  let gap = 0.14
  while (t < now + duration - 0.12) {
    const progress = (t - now) / duration
    const velocity = 0.08 + progress * 0.1
    playTick(ctx, master, t, velocity)
    gap = 0.14 + progress * 0.22
    t += gap
  }

  playLandDing(ctx, master, now + duration)
}
