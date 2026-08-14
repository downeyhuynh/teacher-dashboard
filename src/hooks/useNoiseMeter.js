import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clamp,
  getNoiseStatus,
  getStrikeCooldownMs,
  loadNoiseMeterSettings,
  playStrikeAlert,
  saveNoiseMeterSettings,
  suggestThresholdsFromBaseline,
} from '../utils/noiseMeter'

/** Map analyser RMS (linear) into a 0–100 relative classroom scale. */
function rmsToRelativeLevel(rms, sensitivity) {
  // Typical quiet room ~0.001–0.01; busy class ~0.05–0.2 depending on mic.
  const db = 20 * Math.log10(rms + 1e-8)
  const minDb = -55
  const maxDb = -18
  const normalized = ((db - minDb) / (maxDb - minDb)) * 100
  return clamp(normalized * sensitivity, 0, 100)
}

/**
 * Live mic metering + sustained-noise strike logic.
 * Closing the panel unmounts this hook and releases the microphone.
 */
export function useNoiseMeter() {
  const [settings, setSettingsState] = useState(() => loadNoiseMeterSettings())
  const [listening, setListening] = useState(false)
  const [micError, setMicError] = useState('')
  const [level, setLevel] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [countdownMs, setCountdownMs] = useState(0)
  const [cooldownMs, setCooldownMs] = useState(0)
  const [calibrating, setCalibrating] = useState(false)
  const [calibrateProgress, setCalibrateProgress] = useState(0)
  const [lastCalibrationNote, setLastCalibrationNote] = useState('')

  const settingsRef = useRef(settings)
  const listeningRef = useRef(false)
  const strikesRef = useRef(0)
  const loudAccumMsRef = useRef(0)
  const cooldownUntilRef = useRef(0)
  const smoothedRef = useRef(0)
  const audioRef = useRef(null) // { ctx, stream, analyser, source, raf }
  const calibrateRef = useRef(null) // { samples, startedAt, durationMs }

  useEffect(() => {
    settingsRef.current = settings
    saveNoiseMeterSettings(settings)
  }, [settings])

  useEffect(() => {
    strikesRef.current = strikes
  }, [strikes])

  const stopMicrophone = useCallback(() => {
    listeningRef.current = false
    setListening(false)
    setCalibrating(false)
    setCalibrateProgress(0)
    calibrateRef.current = null
    loudAccumMsRef.current = 0
    setCountdownMs(0)
    setLevel(0)
    smoothedRef.current = 0

    const audio = audioRef.current
    audioRef.current = null
    if (!audio) return

    if (audio.raf) cancelAnimationFrame(audio.raf)
    try {
      audio.source?.disconnect()
    } catch {
      // ignore
    }
    try {
      audio.analyser?.disconnect()
    } catch {
      // ignore
    }
    for (const track of audio.stream?.getTracks?.() || []) {
      track.stop()
    }
    // Do not close shared AudioContext if we reused one — create per session.
    try {
      audio.ctx?.close?.()
    } catch {
      // ignore
    }
  }, [])

  const tick = useCallback((now) => {
    const audio = audioRef.current
    if (!audio || !listeningRef.current) return

    const { analyser, timeData } = audio
    analyser.getByteTimeDomainData(timeData)

    let sumSquares = 0
    for (let i = 0; i < timeData.length; i += 1) {
      const sample = (timeData[i] - 128) / 128
      sumSquares += sample * sample
    }
    const rms = Math.sqrt(sumSquares / timeData.length)
    const instant = rmsToRelativeLevel(rms, settingsRef.current.sensitivity)

    // EMA smooths claps / chair scrapes so short spikes don't look like sustained noise.
    const alpha = 0.18
    smoothedRef.current =
      smoothedRef.current * (1 - alpha) + instant * alpha
    const smoothed = smoothedRef.current
    setLevel(smoothed)

    const last = audio.lastNow ?? now
    const delta = Math.min(250, Math.max(0, now - last))
    audio.lastNow = now

    // Calibration sample window
    if (calibrateRef.current) {
      const cal = calibrateRef.current
      cal.samples.push(smoothed)
      const elapsed = now - cal.startedAt
      setCalibrateProgress(clamp(elapsed / cal.durationMs, 0, 1))
      if (elapsed >= cal.durationMs) {
        const samples = cal.samples
        const avg =
          samples.reduce((sum, value) => sum + value, 0) /
          Math.max(1, samples.length)
        const suggested = suggestThresholdsFromBaseline(avg)
        setSettingsState((prev) => ({
          ...prev,
          warningThreshold: suggested.warningThreshold,
          tooLoudThreshold: suggested.tooLoudThreshold,
        }))
        setLastCalibrationNote(
          `Baseline ~${Math.round(avg)}. Suggested warning ${suggested.warningThreshold}, too loud ${suggested.tooLoudThreshold}.`,
        )
        calibrateRef.current = null
        setCalibrating(false)
        setCalibrateProgress(0)
      }
    }

    const remainingCooldown = Math.max(0, cooldownUntilRef.current - now)
    setCooldownMs(remainingCooldown)

    const { tooLoudThreshold, holdSeconds, maxStrikes, soundAlert } =
      settingsRef.current
    const holdMs = holdSeconds * 1000
    const isTooLoud = smoothed >= tooLoudThreshold
    const inCooldown = remainingCooldown > 0
    const atStrikeCap = strikesRef.current >= maxStrikes

    if (isTooLoud && !inCooldown && !atStrikeCap && !calibrateRef.current) {
      loudAccumMsRef.current = Math.min(holdMs, loudAccumMsRef.current + delta)
      const remaining = Math.max(0, holdMs - loudAccumMsRef.current)
      setCountdownMs(remaining)

      if (loudAccumMsRef.current >= holdMs) {
        loudAccumMsRef.current = 0
        setCountdownMs(0)
        cooldownUntilRef.current = now + getStrikeCooldownMs()
        setCooldownMs(getStrikeCooldownMs())
        setStrikes((prev) => {
          const next = Math.min(maxStrikes, prev + 1)
          strikesRef.current = next
          return next
        })
        if (soundAlert) {
          playStrikeAlert().catch(() => {})
        }
      }
    } else if (!isTooLoud) {
      loudAccumMsRef.current = 0
      setCountdownMs(0)
    } else {
      // Cooldown or at cap while still loud — keep countdown cleared.
      loudAccumMsRef.current = 0
      setCountdownMs(0)
    }

    audio.raf = requestAnimationFrame(tick)
  }, [])

  const startMicrophone = useCallback(async () => {
    setMicError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Microphone access is not supported in this browser.')
      return
    }

    stopMicrophone()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      })

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      if (ctx.state === 'suspended') await ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.35
      source.connect(analyser)
      // Intentionally not connected to destination — analyze only, never play mic.

      const timeData = new Uint8Array(analyser.fftSize)
      audioRef.current = {
        ctx,
        stream,
        source,
        analyser,
        timeData,
        raf: 0,
        lastNow: performance.now(),
      }

      listeningRef.current = true
      setListening(true)
      audioRef.current.raf = requestAnimationFrame(tick)
    } catch (error) {
      const message =
        error?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Allow mic access and try again.'
          : error?.message || 'Could not start the microphone.'
      setMicError(message)
      stopMicrophone()
    }
  }, [stopMicrophone, tick])

  useEffect(() => () => stopMicrophone(), [stopMicrophone])

  const updateSettings = useCallback((patch) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch }
      // Keep warning strictly below too-loud.
      if (next.warningThreshold >= next.tooLoudThreshold) {
        next.warningThreshold = Math.max(5, next.tooLoudThreshold - 5)
      }
      next.sensitivity = clamp(next.sensitivity, 0.4, 2.5)
      next.holdSeconds = clamp(next.holdSeconds, 1, 30)
      next.maxStrikes = clamp(Math.round(next.maxStrikes), 1, 10)
      next.warningThreshold = clamp(next.warningThreshold, 5, 95)
      next.tooLoudThreshold = clamp(next.tooLoudThreshold, 10, 98)
      return next
    })
  }, [])

  const startCalibration = useCallback(() => {
    if (!listeningRef.current) {
      setMicError('Start the microphone before calibrating.')
      return
    }
    setMicError('')
    setLastCalibrationNote('')
    calibrateRef.current = {
      samples: [],
      startedAt: performance.now(),
      durationMs: 5000,
    }
    setCalibrating(true)
    setCalibrateProgress(0)
    loudAccumMsRef.current = 0
    setCountdownMs(0)
  }, [])

  const undoStrike = useCallback(() => {
    setStrikes((prev) => {
      const next = Math.max(0, prev - 1)
      strikesRef.current = next
      return next
    })
  }, [])

  const resetStrikes = useCallback(() => {
    strikesRef.current = 0
    setStrikes(0)
    loudAccumMsRef.current = 0
    cooldownUntilRef.current = 0
    setCountdownMs(0)
    setCooldownMs(0)
  }, [])

  const status = getNoiseStatus(level, settings)

  return {
    settings,
    updateSettings,
    listening,
    micError,
    level,
    status,
    strikes,
    countdownMs,
    cooldownMs,
    calibrating,
    calibrateProgress,
    lastCalibrationNote,
    startMicrophone,
    stopMicrophone,
    startCalibration,
    undoStrike,
    resetStrikes,
  }
}
