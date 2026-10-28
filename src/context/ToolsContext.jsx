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
import { loadLunchRecoveryList, saveLunchRecoveryList } from '../utils/lunchRecoveryList'
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
  resetOvertimeProgressCueMarks,
  playPositiveAdjustBuzz,
  playNegativeAdjustBuzz,
  unlockOvertimeAudio,
} from '../utils/overtimeTick'
import {
  OVERTIME_CLOCK_IDS,
  createEmptyOvertimeClock,
  loadOvertimeClocks,
  readOvertimeElapsed,
  saveOvertimeClocks,
  snapshotOvertimeClocks,
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
  const [lunchRecovery, setLunchRecovery] = useState(() => loadLunchRecoveryList())

  // --- Lesson objective / agenda (per subject × Mon–Fri) ---
  const initialLesson = useMemo(() => loadLessonChrome(), [])
  const [lessonSubject, setLessonSubject] = useState(initialLesson.subject)
  const [lessonDay, setLessonDay] = useState(initialLesson.day)
  const [lessonSubjects, setLessonSubjects] = useState(initialLesson.subjects)
  const [classTracks, setClassTracks] = useState(initialLesson.classTracks)
  const [lessonChromeVisible, setLessonChromeVisible] = useState(
    initialLesson.chromeVisible !== false,
  )

  // --- Overtime stopwatches (soccer / Tabs Hawaii / Caltech) ---
  const [overtimeClocks, setOvertimeClocks] = useState(() => loadOvertimeClocks())
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
    saveLunchRecoveryList(lunchRecovery)
  }, [lunchRecovery])

  useEffect(() => {
    saveLessonChrome({
      subject: lessonSubject,
      day: lessonDay,
      subjects: lessonSubjects,
      classTracks,
      chromeVisible: lessonChromeVisible,
    })
  }, [
    lessonSubject,
    lessonDay,
    lessonSubjects,
    classTracks,
    lessonChromeVisible,
  ])

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
      stopOvertimeTicking()
      return undefined
    }

    let frameId = 0
    const tick = () => {
      const now = performance.now()
      setOvertimeClocks((prev) => {
        let changed = false
        const nextState = { ...prev }
        for (const id of OVERTIME_CLOCK_IDS) {
          const clock = prev[id]
          if (!clock?.running) continue
          if (!clock.anchorAt) {
            changed = true
            nextState[id] = {
              ...clock,
              anchorElapsedMs: clock.elapsedMs,
              anchorAt: now,
            }
            continue
          }
          const elapsedMs = readOvertimeElapsed(clock, now)
          const stopped = clock.mode === 'pay' && elapsedMs <= 0
          const second = Math.floor(elapsedMs / 1000)
          const previousSecond = Math.floor(clock.elapsedMs / 1000)
          if (!stopped && second === previousSecond) continue
          changed = true
          nextState[id] = {
            ...clock,
            elapsedMs: stopped ? 0 : elapsedMs,
            running: !stopped,
            mode: stopped ? 'accrue' : clock.mode,
            anchorAt: stopped ? 0 : clock.anchorAt,
            anchorElapsedMs: stopped ? 0 : clock.anchorElapsedMs,
          }
        }
        return changed ? nextState : prev
      })
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    // Keep ticking across Strict Mode remounts — only stop when no clocks run.
    startOvertimeTicking({ volume: overtimeVolumeRef.current }).catch(() => {})

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [anyOvertimeRunning])

  useEffect(() => {
    setOvertimeTickVolume(overtimeVolume)
  }, [overtimeVolume])

  // Persist when clocks settle (paused/reset/adjust). Skip while RAF is updating every frame.
  useEffect(() => {
    if (anyOvertimeRunning) return
    saveOvertimeClocks(overtimeClocks)
  }, [anyOvertimeRunning, overtimeClocks])

  // While running, snapshot every 2s so a refresh keeps nearly current time.
  useEffect(() => {
    if (!anyOvertimeRunning) return undefined
    const id = window.setInterval(() => {
      saveOvertimeClocks(snapshotOvertimeClocks(overtimeClocksRef.current))
    }, 2000)
    return () => window.clearInterval(id)
  }, [anyOvertimeRunning])

  useEffect(() => {
    const persist = () => saveOvertimeClocks(snapshotOvertimeClocks(overtimeClocksRef.current))
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

  const addLunchStudent = useCallback((group, name) => {
    const key = group === 'caltech' ? 'caltech' : 'hawaii'
    const trimmed = String(name || '').trim()
    if (!trimmed) return
    setLunchRecovery((prev) => ({
      ...prev,
      [key]: [
        { id: createId('lunch'), name: trimmed, strikes: 0, mark: '' },
        ...(prev[key] || []),
      ],
    }))
  }, [])

  const adjustLunchStrikes = useCallback((group, id, delta) => {
    const key = group === 'caltech' ? 'caltech' : 'hawaii'
    const step = Math.trunc(Number(delta) || 0)
    if (!step) return
    setLunchRecovery((prev) => ({
      ...prev,
      [key]: (prev[key] || []).map((entry) => {
        if (entry.id !== id) return entry
        return { ...entry, strikes: Math.max(0, (entry.strikes || 0) + step) }
      }),
    }))
  }, [])

  const setLunchMark = useCallback((group, id, mark) => {
    const key = group === 'caltech' ? 'caltech' : 'hawaii'
    const nextMark = mark === 'M' || mark === 'R' ? mark : ''
    setLunchRecovery((prev) => ({
      ...prev,
      [key]: (prev[key] || []).map((entry) => {
        if (entry.id !== id) return entry
        return { ...entry, mark: entry.mark === nextMark ? '' : nextMark }
      }),
    }))
  }, [])

  const removeLunchStudent = useCallback((group, id) => {
    const key = group === 'caltech' ? 'caltech' : 'hawaii'
    setLunchRecovery((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((entry) => entry.id !== id),
    }))
  }, [])

  const clearLunchRecovery = useCallback((group) => {
    const key = group === 'caltech' ? 'caltech' : 'hawaii'
    setLunchRecovery((prev) => ({
      ...prev,
      [key]: [],
    }))
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

  const toggleLessonChrome = useCallback(() => {
    setLessonChromeVisible((prev) => !prev)
  }, [])

  const setLessonChromeOpen = useCallback((open) => {
    setLessonChromeVisible(Boolean(open))
  }, [])

  const activeLessonContent = getLessonDayContent(
    lessonSubjects,
    lessonSubject,
    lessonDay,
  )

  const startOvertime = useCallback((clockId = 'overtime') => {
    const now = performance.now()
    // Unlock inside the click so the tick is allowed to play.
    unlockOvertimeAudio(overtimeVolumeRef.current)
    startOvertimeTicking({ volume: overtimeVolumeRef.current }).catch(() => {})
    setOvertimeClocks((prev) => {
      const clock = prev[clockId] || createEmptyOvertimeClock()
      const elapsedMs = readOvertimeElapsed(clock, now)
      return {
        ...prev,
        [clockId]: {
          ...clock,
          elapsedMs,
          anchorElapsedMs: elapsedMs,
          anchorAt: now,
          mode: 'accrue',
          running: true,
        },
      }
    })
  }, [])

  const payOvertime = useCallback((clockId = 'overtime') => {
    const now = performance.now()
    const clock = overtimeClocksRef.current?.[clockId]
    if (!clock || readOvertimeElapsed(clock, now) <= 0) return
    unlockOvertimeAudio(overtimeVolumeRef.current)
    startOvertimeTicking({ volume: overtimeVolumeRef.current }).catch(() => {})
    setOvertimeClocks((prev) => {
      const current = prev[clockId] || createEmptyOvertimeClock()
      const elapsedMs = readOvertimeElapsed(current, now)
      if (elapsedMs <= 0) return prev
      return {
        ...prev,
        [clockId]: {
          ...current,
          elapsedMs,
          anchorElapsedMs: elapsedMs,
          anchorAt: now,
          mode: 'pay',
          running: true,
        },
      }
    })
  }, [])

  const pauseOvertime = useCallback((clockId = 'overtime') => {
    const now = performance.now()
    setOvertimeClocks((prev) => {
      const clock = prev[clockId] || createEmptyOvertimeClock()
      return {
        ...prev,
        [clockId]: {
          ...clock,
          elapsedMs: readOvertimeElapsed(clock, now),
          running: false,
          anchorAt: 0,
        },
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
    const now = performance.now()
    unlockOvertimeAudio(overtimeVolumeRef.current)
    setOvertimeClocks((prev) => {
      const clock = prev[clockId] || createEmptyOvertimeClock()
      const elapsedMs = Math.max(0, readOvertimeElapsed(clock, now) + deltaMs)
      return {
        ...prev,
        [clockId]: {
          ...clock,
          elapsedMs,
          anchorElapsedMs: elapsedMs,
          anchorAt: clock.running ? now : 0,
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
      lunchRecovery: {
        lists: lunchRecovery,
        add: addLunchStudent,
        adjustStrikes: adjustLunchStrikes,
        setMark: setLunchMark,
        remove: removeLunchStudent,
        clear: clearLunchRecovery,
      },
      lesson: {
        subject: lessonSubject,
        day: lessonDay,
        objective: activeLessonContent.objective,
        agenda: activeLessonContent.agenda,
        chromeVisible: lessonChromeVisible,
        classTracks: {
          hawaii: getClassTrack(classTracks, lessonDay, 'hawaii'),
          caltech: getClassTrack(classTracks, lessonDay, 'caltech'),
        },
        setObjective: setLessonObjective,
        setAgenda: setLessonAgenda,
        setDay: selectLessonDay,
        setClassTrack,
        toggleChrome: toggleLessonChrome,
        setChromeVisible: setLessonChromeOpen,
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
      lunchRecovery,
      addLunchStudent,
      adjustLunchStrikes,
      setLunchMark,
      removeLunchStudent,
      clearLunchRecovery,
      lessonSubject,
      lessonDay,
      lessonSubjects,
      classTracks,
      lessonChromeVisible,
      setLessonObjective,
      setLessonAgenda,
      selectLessonDay,
      setClassTrack,
      toggleLessonChrome,
      setLessonChromeOpen,
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
