import { LOCKED_DATED_LESSONS } from '../data/lockedDatedLessons.js'
import { dateKey, getActivePeriod, getNextPeriod } from './lessonSchedule'

const STORAGE_KEY = 'teacher-dashboard.lesson-chrome.v3'
const LEGACY_V2_KEY = 'teacher-dashboard.lesson-chrome.v2'
const LEGACY_V1_KEY = 'teacher-dashboard.lesson-chrome.v1'

export const LESSON_SUBJECTS = [
  { id: 'morning-meeting', label: 'Morning Meeting' },
  { id: 'eld', label: 'ELD' },
  { id: 'math', label: 'Math' },
  { id: 'science', label: 'Science' },
  { id: 'plg', label: 'PLG' },
]

export const LESSON_DAYS = [
  { id: 'monday', label: 'Monday', shortLabel: 'Mon' },
  { id: 'tuesday', label: 'Tuesday', shortLabel: 'Tue' },
  { id: 'wednesday', label: 'Wednesday', shortLabel: 'Wed' },
  { id: 'thursday', label: 'Thursday', shortLabel: 'Thu' },
  { id: 'friday', label: 'Friday', shortLabel: 'Fri' },
]

export const LESSON_CLASSES = [
  { id: 'hawaii', label: 'Hawaii' },
  { id: 'caltech', label: 'Caltech' },
]

export const CLASS_TRACKS = [
  { id: 'science', label: 'Science' },
  { id: 'history', label: 'History' },
]

export const FIXED_LESSON_CONTENT = {
  'morning-meeting': {
    objective:
      'Students will develop social-emotional skills through Move This World and prepare themselves for a successful school day.',
    agenda:
      'Move This World SEL activity → Class discussion Prepare materials for the day.',
  },
  eld: {
    objective:
      'Students will strengthen their English-language fundamentals through the ELD workbook, independent reading, or i-Ready Reading.',
    agenda:
      'ELD workbook lesson → English fundamentals practice → i-Ready Reading or silent independent reading.',
  },
}

const SUBJECT_IDS = LESSON_SUBJECTS.map((entry) => entry.id)
const DAY_IDS = LESSON_DAYS.map((entry) => entry.id)
const CLASS_IDS = LESSON_CLASSES.map((entry) => entry.id)
const TRACK_IDS = CLASS_TRACKS.map((entry) => entry.id)
const DATED_SUBJECTS = ['math', 'science']

const EMPTY_CONTENT = { objective: '', agenda: '' }
const DEFAULT_TRACK = 'science'

function emptyDayMap() {
  return Object.fromEntries(DAY_IDS.map((id) => [id, { ...EMPTY_CONTENT }]))
}

function emptySubjects() {
  return Object.fromEntries(SUBJECT_IDS.map((id) => [id, emptyDayMap()]))
}

function emptyClassTracksForDay() {
  return Object.fromEntries(CLASS_IDS.map((id) => [id, DEFAULT_TRACK]))
}

function emptyClassTracks() {
  return Object.fromEntries(DAY_IDS.map((id) => [id, emptyClassTracksForDay()]))
}

function normalizeSubject(value) {
  return SUBJECT_IDS.includes(value) ? value : SUBJECT_IDS[0]
}

function normalizeDay(value) {
  return DAY_IDS.includes(value) ? value : DAY_IDS[0]
}

function normalizeTrack(value) {
  return TRACK_IDS.includes(value) ? value : DEFAULT_TRACK
}

/** Prefer today's weekday when it is Mon–Fri. */
export function defaultLessonDay(date = new Date()) {
  const map = {
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
  }
  return map[date.getDay()] || 'monday'
}

function normalizeDayContent(entry) {
  return {
    objective: String(entry?.objective || ''),
    agenda: String(entry?.agenda || ''),
  }
}

function normalizeClassTracks(raw) {
  const tracks = emptyClassTracks()
  if (!raw || typeof raw !== 'object') return tracks

  if (CLASS_IDS.some((id) => raw[id]) && !DAY_IDS.some((id) => raw[id])) {
    for (const dayId of DAY_IDS) {
      for (const classId of CLASS_IDS) {
        tracks[dayId][classId] = normalizeTrack(raw[classId])
      }
    }
    return tracks
  }

  for (const dayId of DAY_IDS) {
    const dayEntry = raw[dayId] || {}
    for (const classId of CLASS_IDS) {
      tracks[dayId][classId] = normalizeTrack(dayEntry[classId])
    }
  }
  return tracks
}

function normalizeDatedEntry(entry) {
  return {
    math: normalizeDayContent(entry?.math),
    science: normalizeDayContent(entry?.science),
  }
}

function normalizeDatedObjectives(raw) {
  const dated = {}
  if (!raw || typeof raw !== 'object') return dated
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
    dated[key] = normalizeDatedEntry(value)
  }
  return dated
}

function migrateSubjectsFromLegacy(parsed) {
  const subjects = emptySubjects()
  for (const id of SUBJECT_IDS) {
    const entry = parsed?.subjects?.[id] || {}
    if (DAY_IDS.some((dayId) => entry[dayId])) {
      for (const dayId of DAY_IDS) {
        subjects[id][dayId] = normalizeDayContent(entry[dayId])
      }
    } else if (entry.objective || entry.agenda) {
      subjects[id].monday = normalizeDayContent(entry)
    }
  }
  return subjects
}

function plgFromSubjects(subjects) {
  return normalizeDayContent(
    subjects?.plg?.monday ||
      subjects?.plg?.tuesday ||
      subjects?.plg?.wednesday ||
      subjects?.plg?.thursday ||
      subjects?.plg?.friday ||
      EMPTY_CONTENT,
  )
}

function datedFromLegacySubjects(subjects) {
  const dated = {}
  // Seed the upcoming weekdays of the current year from Mon–Fri slots when migrating.
  const year = new Date().getFullYear()
  const dayIds = DAY_IDS
  for (let month = 0; month < 12; month += 1) {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day)
      const weekday = date.getDay()
      if (weekday < 1 || weekday > 5) continue
      const dayId = dayIds[weekday - 1]
      const math = normalizeDayContent(subjects?.math?.[dayId])
      const science = normalizeDayContent(subjects?.science?.[dayId])
      if (!math.objective && !math.agenda && !science.objective && !science.agenda) {
        continue
      }
      dated[dateKey(date)] = { math, science }
    }
  }
  return dated
}

/**
 * @returns {{
 *   subject: string,
 *   day: string,
 *   subjects: Record<string, Record<string, { objective: string, agenda: string }>>,
 *   classTracks: Record<string, Record<string, string>>,
 *   datedObjectives: Record<string, { math: { objective: string, agenda: string }, science: { objective: string, agenda: string } }>,
 *   plg: { objective: string, agenda: string },
 *   chromeVisible: boolean,
 *   followSchedule: boolean,
 * }}
 */
export function loadLessonChrome() {
  const fallback = {
    subject: SUBJECT_IDS[0],
    day: defaultLessonDay(),
    subjects: emptySubjects(),
    classTracks: emptyClassTracks(),
    datedObjectives: {},
    plg: { ...EMPTY_CONTENT },
    chromeVisible: true,
    followSchedule: true,
  }

  try {
    let raw = localStorage.getItem(STORAGE_KEY)
    let parsed = raw ? JSON.parse(raw) : null
    let migratedFromV2 = false

    if (!parsed) {
      const v2Raw = localStorage.getItem(LEGACY_V2_KEY)
      if (v2Raw) {
        parsed = JSON.parse(v2Raw)
        migratedFromV2 = true
      }
    }

    if (!parsed) {
      const legacyRaw = localStorage.getItem(LEGACY_V1_KEY)
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw)
        const subjects = emptySubjects()
        for (const id of SUBJECT_IDS) {
          const entry = legacy?.subjects?.[id]
          if (entry && (entry.objective || entry.agenda)) {
            subjects[id].monday = normalizeDayContent(entry)
          }
        }
        parsed = {
          subject: legacy?.subject,
          day: defaultLessonDay(),
          subjects,
        }
        migratedFromV2 = true
      }
    }

    if (!parsed) return fallback

    const subjects = migrateSubjectsFromLegacy(parsed)
    const datedObjectives = {
      ...(migratedFromV2 ? datedFromLegacySubjects(subjects) : {}),
      ...normalizeDatedObjectives(parsed?.datedObjectives),
      // Locked plan wins for Nov 4 – Dec 18, 2026 weekdays.
      ...LOCKED_DATED_LESSONS,
    }

    return {
      subject: normalizeSubject(parsed?.subject),
      day: normalizeDay(parsed?.day || defaultLessonDay()),
      subjects,
      classTracks: normalizeClassTracks(parsed?.classTracks),
      datedObjectives,
      plg: parsed?.plg
        ? normalizeDayContent(parsed.plg)
        : plgFromSubjects(subjects),
      chromeVisible: parsed?.chromeVisible !== false,
      followSchedule: parsed?.followSchedule !== false,
    }
  } catch {
    return fallback
  }
}

export function saveLessonChrome(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function nextLessonSubject(subject) {
  const index = SUBJECT_IDS.indexOf(normalizeSubject(subject))
  return SUBJECT_IDS[(index + 1) % SUBJECT_IDS.length]
}

export function prevLessonSubject(subject) {
  const index = SUBJECT_IDS.indexOf(normalizeSubject(subject))
  return SUBJECT_IDS[(index - 1 + SUBJECT_IDS.length) % SUBJECT_IDS.length]
}

export function getLessonDayContent(subjects, subjectId, dayId) {
  return (
    subjects?.[subjectId]?.[dayId] || {
      objective: '',
      agenda: '',
    }
  )
}

export function getClassTrack(classTracks, dayId, classId) {
  return normalizeTrack(classTracks?.[dayId]?.[classId])
}

export function isLockedDatedDay(key) {
  return Boolean(LOCKED_DATED_LESSONS?.[key])
}

export function getDatedSubjectContent(datedObjectives, key, subjectId) {
  if (!DATED_SUBJECTS.includes(subjectId)) return { ...EMPTY_CONTENT }
  const locked = LOCKED_DATED_LESSONS?.[key]?.[subjectId]
  if (locked) return normalizeDayContent(locked)
  return normalizeDayContent(datedObjectives?.[key]?.[subjectId])
}

/**
 * Resolve what the Agenda tab should show for a wall-clock moment.
 */
export function resolveLiveLessonContent({
  date = new Date(),
  subject,
  datedObjectives,
  plg,
  followSchedule = true,
}) {
  const active = getActivePeriod(date)
  const next = getNextPeriod(date)
  const betweenClasses = followSchedule && !active
  const liveSubject =
    followSchedule && active ? active.subject : normalizeSubject(subject)
  const key = dateKey(date)
  const fixed = FIXED_LESSON_CONTENT[liveSubject]

  let content = { ...EMPTY_CONTENT }
  // Morning Meeting, ELD, and PLG are standing copy (not calendar-dated).
  if (fixed) {
    content = { ...fixed }
  } else if (liveSubject === 'plg') {
    content = normalizeDayContent(plg)
  } else if (!betweenClasses && (liveSubject === 'math' || liveSubject === 'science')) {
    content = getDatedSubjectContent(datedObjectives, key, liveSubject)
  }

  const meta =
    LESSON_SUBJECTS.find((entry) => entry.id === liveSubject) || LESSON_SUBJECTS[0]
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return {
    subject: liveSubject,
    label: meta.label,
    period: active,
    nextPeriod: next,
    betweenClasses,
    dateKey: key,
    dateLabel,
    objective: content.objective,
    agenda: content.agenda,
    editable:
      !betweenClasses &&
      (liveSubject === 'plg' ||
        liveSubject === 'math' ||
        liveSubject === 'science'),
  }
}

export function upsertDatedObjective(datedObjectives, key, subjectId, patch) {
  if (!DATED_SUBJECTS.includes(subjectId)) return datedObjectives || {}
  const current = normalizeDatedObjectives(datedObjectives)
  const day = normalizeDatedEntry(current[key])
  current[key] = {
    ...day,
    [subjectId]: {
      ...day[subjectId],
      ...normalizeDayContent({ ...day[subjectId], ...patch }),
    },
  }
  return current
}

/** Replace Math + Science content for one calendar day in a single update. */
export function upsertDatedDay(datedObjectives, key, dayContent) {
  const current = normalizeDatedObjectives(datedObjectives)
  current[key] = normalizeDatedEntry({
    math: dayContent?.math,
    science: dayContent?.science,
  })
  return current
}
