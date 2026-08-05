export const CLASS_IDS = {
  HAWAII: 'hawaii',
  CALTECH: 'caltech',
}

export const CLASS_OPTIONS = [
  { id: CLASS_IDS.HAWAII, label: 'Hawaii' },
  { id: CLASS_IDS.CALTECH, label: 'Caltech' },
]

const STORAGE_KEY = 'teacher-dashboard.rosters.v1'

function emptyRosters() {
  return {
    [CLASS_IDS.HAWAII]: [],
    [CLASS_IDS.CALTECH]: [],
  }
}

/**
 * Parse a roster text block into unique trimmed student names.
 */
export function parseRosterText(text) {
  const seen = new Set()
  const names = []

  for (const line of String(text || '').split(/\r?\n/)) {
    const name = line.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }

  return names
}

export function rosterToText(names) {
  return (names || []).join('\n')
}

export function loadRosters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyRosters()
    const parsed = JSON.parse(raw)
    return {
      [CLASS_IDS.HAWAII]: Array.isArray(parsed?.[CLASS_IDS.HAWAII])
        ? parsed[CLASS_IDS.HAWAII].map(String)
        : [],
      [CLASS_IDS.CALTECH]: Array.isArray(parsed?.[CLASS_IDS.CALTECH])
        ? parsed[CLASS_IDS.CALTECH].map(String)
        : [],
    }
  } catch {
    return emptyRosters()
  }
}

export function saveRosters(rosters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rosters))
  } catch {
    // Ignore quota / private mode failures.
  }
}

/**
 * Pick a random student, optionally avoiding recently picked names.
 */
export function pickRandomStudent(students, exclude = []) {
  const pool = students.filter((name) => !exclude.includes(name))
  const source = pool.length > 0 ? pool : students
  if (!source.length) return null
  const index = Math.floor(Math.random() * source.length)
  return source[index]
}
