import { createId } from './id'

export const DEFAULT_CLASS_ID = 'hawaii'

const STORAGE_KEY = 'teacher-dashboard.classes.v1'
/** Legacy key used before custom classrooms. */
const LEGACY_ROSTER_KEY = 'teacher-dashboard.rosters.v1'

function defaultClasses() {
  return [
    { id: 'hawaii', label: 'Hawaii' },
    { id: 'caltech', label: 'Caltech' },
  ]
}

function emptyRosters(classes) {
  const rosters = {}
  for (const entry of classes) {
    rosters[entry.id] = []
  }
  return rosters
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

function normalizeClassList(list) {
  if (!Array.isArray(list)) return defaultClasses()
  const seen = new Set()
  const classes = []
  for (const entry of list) {
    const id = String(entry?.id || '').trim()
    const label = String(entry?.label || '').trim()
    if (!id || !label || seen.has(id)) continue
    seen.add(id)
    classes.push({ id, label })
  }
  return classes.length ? classes : defaultClasses()
}

function normalizeRosters(rosters, classes) {
  const next = emptyRosters(classes)
  if (!rosters || typeof rosters !== 'object') return next
  for (const entry of classes) {
    next[entry.id] = Array.isArray(rosters[entry.id])
      ? rosters[entry.id].map(String)
      : []
  }
  return next
}

/**
 * Load classrooms + rosters. Migrates the old Hawaii/Caltech-only format.
 */
export function loadClassState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const classes = normalizeClassList(parsed?.classes)
      return {
        classes,
        rosters: normalizeRosters(parsed?.rosters, classes),
        activeClassId:
          parsed?.activeClassId &&
          classes.some((entry) => entry.id === parsed.activeClassId)
            ? parsed.activeClassId
            : classes[0].id,
      }
    }

    // Migrate legacy rosters.v1
    const legacyRaw = localStorage.getItem(LEGACY_ROSTER_KEY)
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw)
      const classes = defaultClasses()
      const rosters = normalizeRosters(legacy, classes)
      const state = {
        classes,
        rosters,
        activeClassId: classes[0].id,
      }
      saveClassState(state)
      return state
    }
  } catch {
    // fall through
  }

  const classes = defaultClasses()
  return {
    classes,
    rosters: emptyRosters(classes),
    activeClassId: classes[0].id,
  }
}

export function saveClassState(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        classes: state.classes,
        rosters: state.rosters,
        activeClassId: state.activeClassId,
      }),
    )
  } catch {
    // Ignore quota / private mode failures.
  }
}

/** @deprecated Prefer loadClassState().classes — kept for seating defaults. */
export const CLASS_IDS = {
  HAWAII: DEFAULT_CLASS_ID,
}

/** @deprecated Prefer dynamic classOptions from ToolsContext. */
export const CLASS_OPTIONS = defaultClasses()

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

export function createClassroom(label) {
  const trimmed = String(label || '').trim() || 'New class'
  return {
    id: createId('class'),
    label: trimmed,
  }
}
