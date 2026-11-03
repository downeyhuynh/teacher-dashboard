import { createId } from './id'

const STORAGE_KEY = 'teacher-dashboard.lunch-recovery.v1'

export const LUNCH_GROUPS = [
  { id: 'hawaii', label: 'Hawaii' },
  { id: 'caltech', label: 'Caltech' },
]

export const LUNCH_MARKS = ['M', 'R']

function strikeCount(value) {
  const count = Math.floor(Number(value) || 0)
  return count > 0 ? count : 0
}

function normalizeMarks(value) {
  const raw = Array.isArray(value)
    ? value
    : value
      ? String(value)
          .toUpperCase()
          .split(/[^A-Z]+/)
      : []
  const marks = []
  for (const letter of LUNCH_MARKS) {
    if (raw.some((item) => String(item).trim().toUpperCase() === letter)) {
      marks.push(letter)
    }
  }
  return marks
}

function normalizeEntry(entry) {
  const name = String(entry?.name || '').trim()
  if (!name) return null
  return {
    id: String(entry?.id || createId('lunch')),
    name,
    strikes: strikeCount(entry?.strikes),
    marks: normalizeMarks(entry?.marks ?? entry?.mark),
  }
}

function normalizeList(list) {
  if (!Array.isArray(list)) return []
  return list.map(normalizeEntry).filter(Boolean)
}

function emptyLists() {
  return { hawaii: [], caltech: [] }
}

/**
 * Load lunch recovery lists by school and optional M/R marks.
 * Migrates the older flat array into the Hawaii list.
 * @returns {{ hawaii: { id: string, name: string, strikes: number, marks: string[] }[], caltech: { id: string, name: string, strikes: number, marks: string[] }[] }}
 */
export function loadLunchRecoveryList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyLists()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return { hawaii: normalizeList(parsed), caltech: [] }
    }
    if (!parsed || typeof parsed !== 'object') return emptyLists()
    return {
      hawaii: normalizeList(parsed.hawaii),
      caltech: normalizeList(parsed.caltech),
    }
  } catch {
    return emptyLists()
  }
}

export function saveLunchRecoveryList(lists) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hawaii: normalizeList(lists?.hawaii),
        caltech: normalizeList(lists?.caltech),
      }),
    )
  } catch {
    // Ignore quota / private mode failures.
  }
}
