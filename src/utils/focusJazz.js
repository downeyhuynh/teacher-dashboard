/**
 * Soft ambient “focus jazz” bed for timed work.
 * Synthesized with Web Audio (no media assets).
 */

let sharedContext = null
let masterGain = null
let playing = false
let timers = []
let nodes = []

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

function clearScheduled() {
  for (const id of timers) {
    window.clearTimeout(id)
  }
  timers = []
}

function stopNodes(fadeSeconds = 0.6) {
  const ctx = sharedContext
  if (!ctx || !masterGain) {
    nodes = []
    return
  }

  const now = ctx.currentTime
  try {
    masterGain.gain.cancelScheduledValues(now)
    masterGain.gain.setValueAtTime(masterGain.gain.value, now)
    masterGain.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds)
  } catch {
    // ignore
  }

  const stopAt = now + fadeSeconds + 0.05
  for (const node of nodes) {
    try {
      if (typeof node.stop === 'function') node.stop(stopAt)
    } catch {
      // already stopped
    }
  }
  nodes = []
}

function track(node) {
  nodes.push(node)
  return node
}

function playTone(ctx, destination, { frequency, start, duration, type = 'sine', gain = 0.04 }) {
  const osc = track(ctx.createOscillator())
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, start)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + 0.04)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(g)
  g.connect(destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

function playRhodesChord(ctx, destination, freqs, start, duration) {
  for (const frequency of freqs) {
    // Soft electric-piano-ish stack
    playTone(ctx, destination, {
      frequency,
      start,
      duration,
      type: 'sine',
      gain: 0.028,
    })
    playTone(ctx, destination, {
      frequency: frequency * 2,
      start,
      duration: duration * 0.85,
      type: 'triangle',
      gain: 0.01,
    })
  }
}

function playBrush(ctx, destination, start) {
  const duration = 0.18
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  }

  const noise = track(ctx.createBufferSource())
  const filter = ctx.createBiquadFilter()
  const g = ctx.createGain()
  noise.buffer = buffer
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1800, start)
  g.gain.setValueAtTime(0.03, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  noise.connect(filter)
  filter.connect(g)
  g.connect(destination)
  noise.start(start)
  noise.stop(start + duration + 0.02)
}

/**
 * Schedule one repeating bar of soft jazz-ish accompaniment.
 * @param {number} [phase=0] Chord/bass rotation so each start can feel different.
 */
function scheduleBar(ctx, destination, barStart, beat = 0.78, phase = 0) {
  // Warm ii–V–I-ish colors in C (Dm7 / G7 / Cmaj7 feel), kept simple and soft.
  const progression = [
    [146.83, 174.61, 220.0, 293.66], // D F A D
    [196.0, 246.94, 293.66, 349.23], // G B D F
    [130.81, 164.81, 196.0, 261.63], // C E G C
    [130.81, 164.81, 196.0, 246.94], // C E G B
  ]
  const bassLine = [73.42, 87.31, 98.0, 65.41] // D2 F2 G2 C2-ish
  const rotate = ((phase % 4) + 4) % 4

  for (let index = 0; index < 4; index += 1) {
    const chord = progression[(index + rotate) % progression.length]
    const start = barStart + index * beat
    playRhodesChord(ctx, destination, chord, start, beat * 1.55)
  }

  // Gentle walking bass
  for (let index = 0; index < 4; index += 1) {
    const frequency = bassLine[(index + rotate) % bassLine.length]
    playTone(ctx, destination, {
      frequency,
      start: barStart + index * beat,
      duration: beat * 0.9,
      type: 'triangle',
      gain: 0.045,
    })
  }

  // Soft brushes on 2 and 4
  playBrush(ctx, destination, barStart + beat)
  playBrush(ctx, destination, barStart + beat * 3)
}

let jazzPhase = 0

function loopBars() {
  if (!playing || !sharedContext || !masterGain) return

  const ctx = sharedContext
  const beat = 0.78
  const barLength = beat * 4
  const lead = 0.08
  const start = ctx.currentTime + lead

  // Schedule a few bars ahead, then re-schedule.
  for (let i = 0; i < 2; i += 1) {
    scheduleBar(ctx, masterGain, start + i * barLength, beat, jazzPhase)
  }

  const id = window.setTimeout(() => {
    loopBars()
  }, barLength * 2 * 1000 - 120)
  timers.push(id)
}

/**
 * Start soft focus jazz.
 * Always restarts so each timer Start can begin on a new random chord.
 */
export async function startFocusJazz({ volume = 0.22 } = {}) {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }

  // Force a fresh start (do not early-return while already playing).
  if (playing) {
    playing = false
    clearScheduled()
    stopNodes(0.01)
  } else {
    clearScheduled()
    stopNodes(0.01)
  }

  // Start on a random chord so each timer session feels different.
  jazzPhase = Math.floor(Math.random() * 4)

  masterGain = ctx.createGain()
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.setValueAtTime(-24, ctx.currentTime)
  compressor.knee.setValueAtTime(20, ctx.currentTime)
  compressor.ratio.setValueAtTime(2.5, ctx.currentTime)

  masterGain.gain.setValueAtTime(0.0001, ctx.currentTime)
  masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2)
  masterGain.connect(compressor)
  compressor.connect(ctx.destination)

  playing = true
  loopBars()
}

/**
 * Stop focus jazz with a short fade.
 */
export function stopFocusJazz() {
  if (!playing && nodes.length === 0) return
  playing = false
  clearScheduled()
  stopNodes(0.7)
}

export function isFocusJazzPlaying() {
  return playing
}
