import { createId } from './id'

const STORAGE_KEY = 'teacher-dashboard.restroom-list.v1'

export const RESTROOM_GROUPS = [
  { id: 'hawaii', label: 'Hawaii' },
  { id: 'caltech', label: 'Caltech' },
]

function normalizeEntry(entry) {
  const name = String(entry?.name || '').trim()
  if (!name) return null
  return {
    id: String(entry?.id || createId('restroom')),
    name,
    out: Boolean(entry?.out),
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
 * Load restroom lists by school.
 * Migrates the older flat array into the Hawaii list.
 * @returns {{ hawaii: { id: string, name: string, out: boolean }[], caltech: { id: string, name: string, out: boolean }[] }}
 */
export function loadRestroomList() {
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

export function saveRestroomList(lists) {
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
