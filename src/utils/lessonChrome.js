const STORAGE_KEY = 'teacher-dashboard.lesson-chrome.v1'

export const LESSON_SUBJECTS = [
  { id: 'math', label: 'Math' },
  { id: 'science', label: 'Science' },
]

const EMPTY_CONTENT = { objective: '', agenda: '' }

function emptySubjects() {
  return {
    math: { ...EMPTY_CONTENT },
    science: { ...EMPTY_CONTENT },
  }
}

/**
 * @returns {{
 *   subject: 'math' | 'science',
 *   subjects: {
 *     math: { objective: string, agenda: string },
 *     science: { objective: string, agenda: string },
 *   },
 * }}
 */
export function loadLessonChrome() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { subject: 'math', subjects: emptySubjects() }
    }
    const parsed = JSON.parse(raw)
    const subjects = emptySubjects()
    for (const id of ['math', 'science']) {
      const entry = parsed?.subjects?.[id] || {}
      subjects[id] = {
        objective: String(entry.objective || ''),
        agenda: String(entry.agenda || ''),
      }
    }
    const subject = parsed?.subject === 'science' ? 'science' : 'math'
    return { subject, subjects }
  } catch {
    return { subject: 'math', subjects: emptySubjects() }
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
  return subject === 'math' ? 'science' : 'math'
}

export function prevLessonSubject(subject) {
  return subject === 'math' ? 'science' : 'math'
}
