import { createId } from './id'

const STORAGE_KEY = 'teacher-dashboard.lunch-recovery.v1'

function strikeCount(value) {
  const count = Math.floor(Number(value) || 0)
  return count > 0 ? count : 0
}

/**
 * Load lunch recovery names and strike counts.
 * @returns {{ id: string, name: string, strikes: number }[]}
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
        strikes: strikeCount(entry?.strikes),
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
