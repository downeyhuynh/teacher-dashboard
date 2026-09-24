const STORAGE_KEY = 'teacher-dashboard.lesson-chrome.v2'
const LEGACY_STORAGE_KEY = 'teacher-dashboard.lesson-chrome.v1'

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

const SUBJECT_IDS = LESSON_SUBJECTS.map((entry) => entry.id)
const DAY_IDS = LESSON_DAYS.map((entry) => entry.id)
const CLASS_IDS = LESSON_CLASSES.map((entry) => entry.id)
const TRACK_IDS = CLASS_TRACKS.map((entry) => entry.id)

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

  // Flat shape: { hawaii: 'science', caltech: 'history' }
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

/**
 * @returns {{
 *   subject: string,
 *   day: string,
 *   subjects: Record<string, Record<string, { objective: string, agenda: string }>>,
 *   classTracks: Record<string, Record<string, string>>,
 *   chromeVisible: boolean,
 * }}
 */
export function loadLessonChrome() {
  const fallback = {
    subject: SUBJECT_IDS[0],
    day: defaultLessonDay(),
    subjects: emptySubjects(),
    classTracks: emptyClassTracks(),
    chromeVisible: true,
  }

  try {
    let raw = localStorage.getItem(STORAGE_KEY)
    let parsed = raw ? JSON.parse(raw) : null

    // Migrate flat v1 subject content into Monday slots.
    if (!parsed) {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
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
      }
    }

    if (!parsed) return fallback

    const subjects = emptySubjects()
    for (const id of SUBJECT_IDS) {
      const entry = parsed?.subjects?.[id] || {}
      // Already day-keyed
      if (DAY_IDS.some((dayId) => entry[dayId])) {
        for (const dayId of DAY_IDS) {
          subjects[id][dayId] = normalizeDayContent(entry[dayId])
        }
      } else if (entry.objective || entry.agenda) {
        // Flat leftover shape
        subjects[id].monday = normalizeDayContent(entry)
      }
    }

    return {
      subject: normalizeSubject(parsed?.subject),
      day: normalizeDay(parsed?.day || defaultLessonDay()),
      subjects,
      classTracks: normalizeClassTracks(parsed?.classTracks),
      chromeVisible: parsed?.chromeVisible !== false,
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
