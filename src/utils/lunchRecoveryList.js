import { createId } from './id'

const STORAGE_KEY = 'teacher-dashboard.lunch-recovery.v1'

/**
 * Load lunch recovery names.
 * @returns {{ id: string, name: string }[]}
 */
export function loadLunchRecoveryList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => ({
        id: String(entry?.id || createId('lunch')),
        name: String(entry?.name || '').trim(),
      }))
      .filter((entry) => entry.name)
  } catch {
    return []
  }
}

export function saveLunchRecoveryList(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []))
  } catch {
    // Ignore quota / private mode failures.
  }
}
