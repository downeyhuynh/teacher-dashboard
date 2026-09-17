import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { TIMER_PRESETS } from '../utils/time'
import {
  clearFocusTrack,
  loadStoredFocusTrack,
  saveFocusTrack,
  startFocusMusic,
  stopFocusMusic,
} from '../utils/focusMusic'
import {
  createClassroom,
  loadClassState,
  parseRosterText,
  pickRandomStudent,
  saveClassState,
} from '../utils/roster'

const ToolsContext = createContext(null)

/**
 * Domain state for tools that must survive panel minimize/close.
 */
export function ToolsProvider({ children }) {
  const [timerMode, setTimerMode] = useState('countdown') // countdown | stopwatch
  const [timerDurationMs, setTimerDurationMs] = useState(TIMER_PRESETS[2].ms)
  const [timerRemainingMs, setTimerRemainingMs] = useState(TIMER_PRESETS[2].ms)
  const [timerElapsedMs, setTimerElapsedMs] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerFinished, setTimerFinished] = useState(false)
  const [timerCompact, setTimerCompact] = useState(false)
  const [musicSession, setMusicSession] = useState(0)
  const [focusMusicEnabled, setFocusMusicEnabled] = useState(true)
  const [focusTrack, setFocusTrack] = useState(null) // { name, url } | null
  const lastTickRef = useRef(null)

  // --- Random student picker / classrooms ---
  const initialClasses = useMemo(() => loadClassState(), [])
  const [classOptions, setClassOptions] = useState(initialClasses.classes)
  const [rosters, setRosters] = useState(initialClasses.rosters)
  const [activeClassId, setActiveClassId] = useState(initialClasses.activeClassId)
  const [pickedStudent, setPickedStudent] = useState(null)
  const [pickedHistory, setPickedHistory] = useState([])
  const [avoidRepeats, setAvoidRepeats] = useState(true)

  useEffect(() => {
    saveClassState({ classes: classOptions, rosters, activeClassId })
  }, [classOptions, rosters, activeClassId])

  useEffect(() => {
    let cancelled = false
    loadStoredFocusTrack().then((track) => {
      if (!cancelled && track) setFocusTrack(track)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!timerRunning) {
      lastTickRef.current = null
      return undefined
    }

    lastTickRef.current = performance.now()
    let frameId = 0

    const tick = (now) => {
      const last = lastTickRef.current ?? now
      const delta = now - last
      lastTickRef.current = now

      if (timerMode === 'countdown') {
        setTimerRemainingMs((prev) => {
          const next = Math.max(0, prev - delta)
          if (next <= 0) {
            setTimerRunning(false)
            setTimerFinished(true)
          }
          return next
        })
      } else {
        setTimerElapsedMs((prev) => prev + delta)
      }

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [timerMode, timerRunning])

  // Focus music (uploaded MP3 or soft jazz) while the timer is running.
  // musicSession bumps on every Start so each press picks a new random spot.
  useEffect(() => {
    let cancelled = false

    const syncMusic = async () => {
      if (timerRunning && focusMusicEnabled) {
        try {
          await startFocusMusic({ trackUrl: focusTrack?.url || null })
          if (cancelled) stopFocusMusic()
        } catch {
          // Autoplay / audio restrictions — ignore quietly.
        }
      } else {
        stopFocusMusic()
      }
    }

    syncMusic()

    return () => {
      cancelled = true
      stopFocusMusic()
    }
  }, [timerRunning, focusMusicEnabled, focusTrack?.url, musicSession])

  useEffect(() => {
    return () => stopFocusMusic()
  }, [])

  const uploadFocusTrack = useCallback(async (file) => {
    const track = await saveFocusTrack(file)
    setFocusTrack(track)
    return track
  }, [])

  const removeFocusTrack = useCallback(async () => {
    await clearFocusTrack()
    setFocusTrack(null)
  }, [])

  const startTimer = useCallback(() => {
    setTimerFinished(false)
    if (timerMode === 'countdown') {
      setTimerRemainingMs((prev) => (prev <= 0 ? timerDurationMs : prev))
    }
    setTimerRunning(true)
    setTimerCompact(true)
    setMusicSession((prev) => prev + 1)
  }, [timerDurationMs, timerMode])

  const pauseTimer = useCallback(() => {
    setTimerRunning(false)
  }, [])

  const resetTimer = useCallback(() => {
    setTimerRunning(false)
    setTimerFinished(false)
    setTimerElapsedMs(0)
    setTimerRemainingMs(timerDurationMs)
    setTimerCompact(false)
  }, [timerDurationMs])

  const applyTimerPreset = useCallback((ms) => {
    setTimerMode('countdown')
    setTimerDurationMs(ms)
    setTimerRemainingMs(ms)
    setTimerElapsedMs(0)
    setTimerRunning(false)
    setTimerFinished(false)
    setTimerCompact(false)
  }, [])

  const setCustomDurationMinutes = useCallback((minutes) => {
    const ms = Math.max(1, Math.round(Number(minutes) || 1)) * 60_000
    applyTimerPreset(ms)
  }, [applyTimerPreset])

  const switchTimerMode = useCallback((mode) => {
    setTimerMode(mode)
    setTimerRunning(false)
    setTimerFinished(false)
    setTimerElapsedMs(0)
    setTimerRemainingMs(timerDurationMs)
    setTimerCompact(false)
  }, [timerDurationMs])

  const expandTimer = useCallback(() => {
    setTimerCompact(false)
  }, [])

  const setClassRosterText = useCallback((classId, text) => {
    const names = parseRosterText(text)
    setRosters((prev) => ({ ...prev, [classId]: names }))
    setPickedStudent(null)
    setPickedHistory([])
  }, [])

  const selectClass = useCallback((classId) => {
    setActiveClassId(classId)
    setPickedStudent(null)
    setPickedHistory([])
  }, [])

  const addClassroom = useCallback((label) => {
    const classroom = createClassroom(label)
    setClassOptions((prev) => [...prev, classroom])
    setRosters((prev) => ({ ...prev, [classroom.id]: [] }))
    setActiveClassId(classroom.id)
    setPickedStudent(null)
    setPickedHistory([])
    return classroom.id
  }, [])

  const renameClassroom = useCallback((classId, label) => {
    const trimmed = String(label || '').trim()
    if (!trimmed) return
    setClassOptions((prev) =>
      prev.map((entry) =>
        entry.id === classId ? { ...entry, label: trimmed } : entry,
      ),
    )
  }, [])

  const deleteClassroom = useCallback((classId) => {
    setClassOptions((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((entry) => entry.id !== classId)
      setActiveClassId((current) =>
        current === classId ? next[0].id : current,
      )
      return next
    })
    setRosters((prev) => {
      const next = { ...prev }
      delete next[classId]
      return next
    })
    setPickedStudent(null)
    setPickedHistory([])
  }, [])

  const resolveNextPick = useCallback(() => {
    const students = rosters[activeClassId] || []
    const exclude = avoidRepeats ? pickedHistory : []
    const next = pickRandomStudent(students, exclude)
    if (!next) return null
    return {
      name: next,
      index: students.indexOf(next),
      students,
    }
  }, [activeClassId, avoidRepeats, pickedHistory, rosters])

  const commitPick = useCallback(
    (name) => {
      if (!name) {
        setPickedStudent(null)
        return
      }

      const students = rosters[activeClassId] || []
      setPickedStudent(name)
      setPickedHistory((prev) => {
        if (prev.includes(name)) return prev
        const updated = [...prev, name]
        if (updated.length >= students.length) return []
        return updated
      })
    },
    [activeClassId, rosters],
  )

  const pickStudentInstant = useCallback(() => {
    const next = resolveNextPick()
    if (!next) {
      setPickedStudent(null)
      return
    }
    commitPick(next.name)
  }, [commitPick, resolveNextPick])

  const resetPicks = useCallback(() => {
    setPickedStudent(null)
    setPickedHistory([])
  }, [])

  const value = useMemo(
    () => ({
      timer: {
        mode: timerMode,
        durationMs: timerDurationMs,
        remainingMs: timerRemainingMs,
        elapsedMs: timerElapsedMs,
        running: timerRunning,
        finished: timerFinished,
        compact: timerCompact,
        focusMusicEnabled,
        focusTrack,
        presets: TIMER_PRESETS,
        start: startTimer,
        pause: pauseTimer,
        reset: resetTimer,
        expand: expandTimer,
        applyPreset: applyTimerPreset,
        setCustomDurationMinutes,
        switchMode: switchTimerMode,
        setFocusMusicEnabled,
        uploadFocusTrack,
        removeFocusTrack,
      },
      picker: {
        classOptions,
        activeClassId,
        rosters,
        pickedStudent,
        pickedHistory,
        avoidRepeats,
        selectClass,
        setClassRosterText,
        addClassroom,
        renameClassroom,
        deleteClassroom,
        resolveNextPick,
        commitPick,
        pickStudentInstant,
        resetPicks,
        setAvoidRepeats,
        activeRoster: rosters[activeClassId] || [],
      },
    }),
    [
      timerMode,
      timerDurationMs,
      timerRemainingMs,
      timerElapsedMs,
      timerRunning,
      timerFinished,
      timerCompact,
      focusMusicEnabled,
      focusTrack,
      startTimer,
      pauseTimer,
      resetTimer,
      expandTimer,
      applyTimerPreset,
      setCustomDurationMinutes,
      switchTimerMode,
      uploadFocusTrack,
      removeFocusTrack,
      classOptions,
      activeClassId,
      rosters,
      pickedStudent,
      pickedHistory,
      avoidRepeats,
      selectClass,
      setClassRosterText,
      addClassroom,
      renameClassroom,
      deleteClassroom,
      resolveNextPick,
      commitPick,
      pickStudentInstant,
      resetPicks,
    ],
  )

  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>
}

export function useTools() {
  const context = useContext(ToolsContext)
  if (!context) {
    throw new Error('useTools must be used within ToolsProvider')
  }
  return context
}
