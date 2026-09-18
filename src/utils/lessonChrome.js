const STORAGE_KEY = 'teacher-dashboard.lesson-chrome.v1'

export const LESSON_SUBJECTS = [
  { id: 'morning-meeting', label: 'Morning Meeting' },
  { id: 'eld', label: 'ELD' },
  { id: 'math', label: 'Math' },
  { id: 'science', label: 'Science' },
  { id: 'plg', label: 'PLG' },
]

const SUBJECT_IDS = LESSON_SUBJECTS.map((entry) => entry.id)

const EMPTY_CONTENT = { objective: '', agenda: '' }

function emptySubjects() {
  return Object.fromEntries(
    SUBJECT_IDS.map((id) => [id, { ...EMPTY_CONTENT }]),
  )
}

function normalizeSubject(value) {
  return SUBJECT_IDS.includes(value) ? value : SUBJECT_IDS[0]
}

/**
 * @returns {{
 *   subject: string,
 *   subjects: Record<string, { objective: string, agenda: string }>,
 * }}
 */
export function loadLessonChrome() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { subject: SUBJECT_IDS[0], subjects: emptySubjects() }
    }
    const parsed = JSON.parse(raw)
    const subjects = emptySubjects()
    for (const id of SUBJECT_IDS) {
      const entry = parsed?.subjects?.[id] || {}
      subjects[id] = {
        objective: String(entry.objective || ''),
        agenda: String(entry.agenda || ''),
      }
    }
    return {
      subject: normalizeSubject(parsed?.subject),
      subjects,
    }
  } catch {
    return { subject: SUBJECT_IDS[0], subjects: emptySubjects() }
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
