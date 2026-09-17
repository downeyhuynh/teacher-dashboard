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
  setFocusMusicVolume,
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
import { createId } from '../utils/id'
import { loadRestroomList, saveRestroomList } from '../utils/restroomList'
import {
  loadLessonChrome,
  saveLessonChrome,
  nextLessonSubject,
  prevLessonSubject,
} from '../utils/lessonChrome'
import {
  setOvertimeTickVolume,
  startOvertimeTicking,
  stopOvertimeTicking,
} from '../utils/overtimeTick'

const VOLUME_STORAGE_KEY = 'teacher-dashboard.audio-volumes.v1'

function loadVolumes() {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (!raw) return { focusMusic: 0.55, overtime: 0.55 }
    const parsed = JSON.parse(raw)
    return {
      focusMusic: clampVolume(parsed?.focusMusic, 0.55),
      overtime: clampVolume(parsed?.overtime, 0.55),
    }
  } catch {
    return { focusMusic: 0.55, overtime: 0.55 }
  }
}

function clampVolume(value, fallback) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.min(1, Math.max(0, next))
}

function saveVolumes(volumes) {
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(volumes))
  } catch {
    // Ignore quota / private mode failures.
  }
}

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
  const initialVolumes = useMemo(() => loadVolumes(), [])
  const [focusMusicVolume, setFocusMusicVolumeState] = useState(
    initialVolumes.focusMusic,
  )
  const [overtimeVolume, setOvertimeVolumeState] = useState(
    initialVolumes.overtime,
  )
  const lastTickRef = useRef(null)

  // --- Random student picker / classrooms ---
  const initialClasses = useMemo(() => loadClassState(), [])
  const [classOptions, setClassOptions] = useState(initialClasses.classes)
  const [rosters, setRosters] = useState(initialClasses.rosters)
  const [activeClassId, setActiveClassId] = useState(initialClasses.activeClassId)
  const [pickedStudent, setPickedStudent] = useState(null)
  const [pickedHistory, setPickedHistory] = useState([])
  const [avoidRepeats, setAvoidRepeats] = useState(true)

  // --- Restroom out list (survives panel close + refresh) ---
  const [restroomOut, setRestroomOut] = useState(() => loadRestroomList())

  // --- Lesson objective / agenda (Math ↔ Science) ---
  const initialLesson = useMemo(() => loadLessonChrome(), [])
  const [lessonSubject, setLessonSubject] = useState(initialLesson.subject)
  const [lessonSubjects, setLessonSubjects] = useState(initialLesson.subjects)

  // --- Overtime stopwatch (keeps ticking if panel is closed) ---
  const [overtimeElapsedMs, setOvertimeElapsedMs] = useState(0)
  const [overtimeRunning, setOvertimeRunning] = useState(false)
  const [overtimeMode, setOvertimeMode] = useState('accrue') // accrue | pay
  const overtimeTickRef = useRef(null)

  useEffect(() => {
    saveClassState({ classes: classOptions, rosters, activeClassId })
  }, [classOptions, rosters, activeClassId])

  useEffect(() => {
    saveRestroomList(restroomOut)
  }, [restroomOut])

  useEffect(() => {
    saveLessonChrome({ subject: lessonSubject, subjects: lessonSubjects })
  }, [lessonSubject, lessonSubjects])

  useEffect(() => {
    setFocusMusicVolume(focusMusicVolume)
    setOvertimeTickVolume(overtimeVolume)
    saveVolumes({ focusMusic: focusMusicVolume, overtime: overtimeVolume })
  }, [focusMusicVolume, overtimeVolume])

  useEffect(() => {
    if (!overtimeRunning) {
      overtimeTickRef.current = null
      return undefined
    }

    overtimeTickRef.current = performance.now()
    let frameId = 0
    const tick = (now) => {
      const last = overtimeTickRef.current ?? now
      const delta = now - last
      overtimeTickRef.current = now

      if (overtimeMode === 'pay') {
        setOvertimeElapsedMs((prev) => {
          const next = Math.max(0, prev - delta)
          if (next <= 0) {
            setOvertimeRunning(false)
            setOvertimeMode('accrue')
          }
          return next
        })
      } else {
        setOvertimeElapsedMs((prev) => prev + delta)
      }

      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [overtimeRunning, overtimeMode])

  useEffect(() => {
    if (!overtimeRunning) {
      stopOvertimeTicking()
      return undefined
    }
    startOvertimeTicking({ volume: overtimeVolume }).catch(() => {})
    return () => stopOvertimeTicking()
  }, [overtimeRunning, overtimeVolume])

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
          await startFocusMusic({
            trackUrl: focusTrack?.url || null,
            volume: focusMusicVolume,
          })
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

  const addRestroomStudent = useCallback((name) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) return
    setRestroomOut((prev) => [
      { id: createId('restroom'), name: trimmed },
      ...prev,
    ])
  }, [])

  const removeRestroomStudent = useCallback((id) => {
    setRestroomOut((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  const clearRestroomList = useCallback(() => {
    setRestroomOut([])
  }, [])

  const setLessonObjective = useCallback(
    (value) => {
      setLessonSubjects((prev) => ({
        ...prev,
        [lessonSubject]: {
          ...prev[lessonSubject],
          objective: value,
        },
      }))
    },
    [lessonSubject],
  )

  const setLessonAgenda = useCallback(
    (value) => {
      setLessonSubjects((prev) => ({
        ...prev,
        [lessonSubject]: {
          ...prev[lessonSubject],
          agenda: value,
        },
      }))
    },
    [lessonSubject],
  )

  const goNextLessonSubject = useCallback(() => {
    setLessonSubject((prev) => nextLessonSubject(prev))
  }, [])

  const goPrevLessonSubject = useCallback(() => {
    setLessonSubject((prev) => prevLessonSubject(prev))
  }, [])

  const startOvertime = useCallback(() => {
    setOvertimeElapsedMs((prev) => {
      if (prev <= 0) setOvertimeMode('accrue')
      return prev
    })
    setOvertimeRunning(true)
  }, [])

  const payOvertime = useCallback(() => {
    setOvertimeElapsedMs((prev) => {
      if (prev <= 0) return prev
      setOvertimeMode('pay')
      setOvertimeRunning(true)
      return prev
    })
  }, [])

  const pauseOvertime = useCallback(() => {
    setOvertimeRunning(false)
  }, [])

  const resetOvertime = useCallback(() => {
    setOvertimeRunning(false)
    setOvertimeMode('accrue')
    setOvertimeElapsedMs(0)
    stopOvertimeTicking()
  }, [])

  const setFocusMusicVolumeLevel = useCallback((value) => {
    setFocusMusicVolumeState(clampVolume(value, 0.55))
  }, [])

  const setOvertimeVolumeLevel = useCallback((value) => {
    setOvertimeVolumeState(clampVolume(value, 0.55))
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
        focusMusicVolume,
        setFocusMusicVolume: setFocusMusicVolumeLevel,
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
      restroom: {
        out: restroomOut,
        add: addRestroomStudent,
        remove: removeRestroomStudent,
        clear: clearRestroomList,
      },
      lesson: {
        subject: lessonSubject,
        objective: lessonSubjects[lessonSubject]?.objective || '',
        agenda: lessonSubjects[lessonSubject]?.agenda || '',
        setObjective: setLessonObjective,
        setAgenda: setLessonAgenda,
        nextSubject: goNextLessonSubject,
        prevSubject: goPrevLessonSubject,
      },
      overtime: {
        elapsedMs: overtimeElapsedMs,
        running: overtimeRunning,
        mode: overtimeMode,
        volume: overtimeVolume,
        start: startOvertime,
        pay: payOvertime,
        pause: pauseOvertime,
        reset: resetOvertime,
        setVolume: setOvertimeVolumeLevel,
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
      focusMusicVolume,
      startTimer,
      pauseTimer,
      resetTimer,
      expandTimer,
      applyTimerPreset,
      setCustomDurationMinutes,
      switchTimerMode,
      uploadFocusTrack,
      removeFocusTrack,
      setFocusMusicVolumeLevel,
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
      restroomOut,
      addRestroomStudent,
      removeRestroomStudent,
      clearRestroomList,
      lessonSubject,
      lessonSubjects,
      setLessonObjective,
      setLessonAgenda,
      goNextLessonSubject,
      goPrevLessonSubject,
      overtimeElapsedMs,
      overtimeRunning,
      overtimeMode,
      overtimeVolume,
      startOvertime,
      payOvertime,
      pauseOvertime,
      resetOvertime,
      setOvertimeVolumeLevel,
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
