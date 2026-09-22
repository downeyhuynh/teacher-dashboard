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
  getLessonDayContent,
  getClassTrack,
} from '../utils/lessonChrome'
import {
  setOvertimeTickVolume,
  startOvertimeTicking,
  stopOvertimeTicking,
  maybePlayOvertimeProgressCues,
  resetOvertimeProgressCueMarks,
  playPositiveAdjustBuzz,
  playNegativeAdjustBuzz,
} from '../utils/overtimeTick'
import {
  OVERTIME_CLOCK_IDS,
  createEmptyOvertimeClock,
  loadOvertimeClocks,
  saveOvertimeClocks,
} from '../utils/overtimeClocks'

const VOLUME_STORAGE_KEY = 'teacher-dashboard.audio-volumes.v1'

function loadVolumes() {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (!raw) return { focusMusic: 0.55, overtime: 0.75 }
    const parsed = JSON.parse(raw)
    return {
      focusMusic: clampVolume(parsed?.focusMusic, 0.55),
      overtime: clampVolume(parsed?.overtime, 0.75),
    }
  } catch {
    return { focusMusic: 0.55, overtime: 0.75 }
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

  // --- Lesson objective / agenda (per subject × Mon–Fri) ---
  const initialLesson = useMemo(() => loadLessonChrome(), [])
  const [lessonSubject, setLessonSubject] = useState(initialLesson.subject)
  const [lessonDay, setLessonDay] = useState(initialLesson.day)
  const [lessonSubjects, setLessonSubjects] = useState(initialLesson.subjects)
  const [classTracks, setClassTracks] = useState(initialLesson.classTracks)

  // --- Overtime stopwatches (soccer / Tabs Hawaii / Caltech) ---
  const [overtimeClocks, setOvertimeClocks] = useState(() => loadOvertimeClocks())
  const overtimeFrameRef = useRef(null)
  const overtimeClocksRef = useRef(overtimeClocks)
  overtimeClocksRef.current = overtimeClocks
  const overtimeVolumeRef = useRef(overtimeVolume)
  overtimeVolumeRef.current = overtimeVolume

  useEffect(() => {
    saveClassState({ classes: classOptions, rosters, activeClassId })
  }, [classOptions, rosters, activeClassId])

  useEffect(() => {
    saveRestroomList(restroomOut)
  }, [restroomOut])

  useEffect(() => {
    saveLessonChrome({
      subject: lessonSubject,
      day: lessonDay,
      subjects: lessonSubjects,
      classTracks,
    })
  }, [lessonSubject, lessonDay, lessonSubjects, classTracks])

  useEffect(() => {
    setFocusMusicVolume(focusMusicVolume)
    setOvertimeTickVolume(overtimeVolume)
    saveVolumes({ focusMusic: focusMusicVolume, overtime: overtimeVolume })
  }, [focusMusicVolume, overtimeVolume])

  const anyOvertimeRunning = OVERTIME_CLOCK_IDS.some(
    (id) => overtimeClocks[id]?.running,
  )

  useEffect(() => {
    if (!anyOvertimeRunning) {
      overtimeFrameRef.current = null
      stopOvertimeTicking()
      return undefined
    }

    overtimeFrameRef.current = performance.now()
    let frameId = 0
    const tick = (now) => {
      const last = overtimeFrameRef.current ?? now
      const delta = now - last
      overtimeFrameRef.current = now

      const pendingCues = []
      setOvertimeClocks((prev) => {
        let changed = false
        const nextState = { ...prev }
        for (const id of OVERTIME_CLOCK_IDS) {
          const clock = prev[id]
          if (!clock?.running) continue
          changed = true
          if (clock.mode === 'pay') {
            const elapsedMs = Math.max(0, clock.elapsedMs - delta)
            nextState[id] = {
              ...clock,
              elapsedMs,
              running: elapsedMs > 0,
              mode: elapsedMs > 0 ? 'pay' : 'accrue',
            }
          } else {
            const elapsedMs = clock.elapsedMs + delta
            nextState[id] = { ...clock, elapsedMs }
            pendingCues.push({ id, elapsedMs })
          }
        }
        return changed ? nextState : prev
      })
      for (const cue of pendingCues) {
        maybePlayOvertimeProgressCues(
          cue.elapsedMs,
          overtimeVolumeRef.current,
          cue.id,
        )
      }

      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    startOvertimeTicking({ volume: overtimeVolume }).catch(() => {})

    return () => {
      cancelAnimationFrame(frameId)
      stopOvertimeTicking()
    }
  }, [anyOvertimeRunning, overtimeVolume])

  // Persist when clocks settle (paused/reset/adjust). Skip while RAF is updating every frame.
  useEffect(() => {
    if (anyOvertimeRunning) return
    saveOvertimeClocks(overtimeClocks)
  }, [anyOvertimeRunning, overtimeClocks])

  // While running, snapshot every 2s so a refresh keeps nearly current time.
  useEffect(() => {
    if (!anyOvertimeRunning) return undefined
    const id = window.setInterval(() => {
      saveOvertimeClocks(overtimeClocksRef.current)
    }, 2000)
    return () => window.clearInterval(id)
  }, [anyOvertimeRunning])

  useEffect(() => {
    const persist = () => saveOvertimeClocks(overtimeClocksRef.current)
    window.addEventListener('pagehide', persist)
    window.addEventListener('beforeunload', persist)
    return () => {
      window.removeEventListener('pagehide', persist)
      window.removeEventListener('beforeunload', persist)
    }
  }, [])

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
      { id: createId('restroom'), name: trimmed, out: false },
      ...prev,
    ])
  }, [])

  const removeRestroomStudent = useCallback((id) => {
    setRestroomOut((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  const toggleRestroomStudent = useCallback((id) => {
    setRestroomOut((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, out: !entry.out } : entry,
      ),
    )
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
          [lessonDay]: {
            ...getLessonDayContent(prev, lessonSubject, lessonDay),
            objective: value,
          },
        },
      }))
    },
    [lessonSubject, lessonDay],
  )

  const setLessonAgenda = useCallback(
    (value) => {
      setLessonSubjects((prev) => ({
        ...prev,
        [lessonSubject]: {
          ...prev[lessonSubject],
          [lessonDay]: {
            ...getLessonDayContent(prev, lessonSubject, lessonDay),
            agenda: value,
          },
        },
      }))
    },
    [lessonSubject, lessonDay],
  )

  const goNextLessonSubject = useCallback(() => {
    setLessonSubject((prev) => nextLessonSubject(prev))
  }, [])

  const goPrevLessonSubject = useCallback(() => {
    setLessonSubject((prev) => prevLessonSubject(prev))
  }, [])

  const selectLessonDay = useCallback((dayId) => {
    setLessonDay(dayId)
  }, [])

  const setClassTrack = useCallback(
    (classId, trackId) => {
      setClassTracks((prev) => ({
        ...prev,
        [lessonDay]: {
          ...(prev[lessonDay] || {}),
          [classId]: trackId,
        },
      }))
    },
    [lessonDay],
  )

  const activeLessonContent = getLessonDayContent(
    lessonSubjects,
    lessonSubject,
    lessonDay,
  )

  const startOvertime = useCallback((clockId = 'overtime') => {
    setOvertimeClocks((prev) => {
      const clock = prev[clockId] || createEmptyOvertimeClock()
      return {
        ...prev,
        [clockId]: {
          ...clock,
          mode: clock.elapsedMs <= 0 ? 'accrue' : clock.mode,
          running: true,
        },
      }
    })
  }, [])

  const payOvertime = useCallback((clockId = 'overtime') => {
    setOvertimeClocks((prev) => {
      const clock = prev[clockId] || createEmptyOvertimeClock()
      if (clock.elapsedMs <= 0) return prev
      return {
        ...prev,
        [clockId]: {
          ...clock,
          mode: 'pay',
          running: true,
        },
      }
    })
  }, [])

  const pauseOvertime = useCallback((clockId = 'overtime') => {
    setOvertimeClocks((prev) => {
      const clock = prev[clockId] || createEmptyOvertimeClock()
      return {
        ...prev,
        [clockId]: { ...clock, running: false },
      }
    })
  }, [])

  const resetOvertime = useCallback((clockId = 'overtime') => {
    resetOvertimeProgressCueMarks(clockId)
    setOvertimeClocks((prev) => ({
      ...prev,
      [clockId]: createEmptyOvertimeClock(),
    }))
  }, [])

  const adjustOvertimeSeconds = useCallback((clockId, deltaSeconds) => {
    const deltaMs = Math.round(Number(deltaSeconds) || 0) * 1000
    if (!deltaMs) return
    setOvertimeClocks((prev) => {
      const clock = prev[clockId] || createEmptyOvertimeClock()
      return {
        ...prev,
        [clockId]: {
          ...clock,
          elapsedMs: Math.max(0, clock.elapsedMs + deltaMs),
        },
      }
    })
    if (deltaSeconds > 0) {
      playPositiveAdjustBuzz(overtimeVolumeRef.current).catch(() => {})
    } else {
      playNegativeAdjustBuzz(overtimeVolumeRef.current).catch(() => {})
    }
  }, [])

  const setFocusMusicVolumeLevel = useCallback((value) => {
    setFocusMusicVolumeState(clampVolume(value, 0.55))
  }, [])

  const setOvertimeVolumeLevel = useCallback((value) => {
    setOvertimeVolumeState(clampVolume(value, 0.75))
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
        toggle: toggleRestroomStudent,
        clear: clearRestroomList,
      },
      lesson: {
        subject: lessonSubject,
        day: lessonDay,
        objective: activeLessonContent.objective,
        agenda: activeLessonContent.agenda,
        classTracks: {
          hawaii: getClassTrack(classTracks, lessonDay, 'hawaii'),
          caltech: getClassTrack(classTracks, lessonDay, 'caltech'),
        },
        setObjective: setLessonObjective,
        setAgenda: setLessonAgenda,
        setDay: selectLessonDay,
        setClassTrack,
        nextSubject: goNextLessonSubject,
        prevSubject: goPrevLessonSubject,
      },
      overtime: {
        clocks: overtimeClocks,
        volume: overtimeVolume,
        setVolume: setOvertimeVolumeLevel,
        start: startOvertime,
        pay: payOvertime,
        pause: pauseOvertime,
        reset: resetOvertime,
        adjustSeconds: adjustOvertimeSeconds,
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
      toggleRestroomStudent,
      clearRestroomList,
      lessonSubject,
      lessonDay,
      lessonSubjects,
      classTracks,
      setLessonObjective,
      setLessonAgenda,
      selectLessonDay,
      setClassTrack,
      goNextLessonSubject,
      goPrevLessonSubject,
      overtimeClocks,
      overtimeVolume,
      startOvertime,
      payOvertime,
      pauseOvertime,
      resetOvertime,
      adjustOvertimeSeconds,
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
