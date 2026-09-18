import { createId } from './id'

const STORAGE_KEY = 'teacher-dashboard.restroom-list.v1'

/**
 * Load restroom list entries.
 * @returns {{ id: string, name: string, out: boolean }[]}
 */
export function loadRestroomList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => ({
        id: String(entry?.id || createId('restroom')),
        name: String(entry?.name || '').trim(),
        out: Boolean(entry?.out),
      }))
      .filter((entry) => entry.name)
  } catch {
    return []
  }
}

export function saveRestroomList(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []))
  } catch {
    // Ignore quota / private mode failures.
  }
}
