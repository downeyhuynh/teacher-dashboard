/**
 * Create a unique id for slides and stroke groups.
 */
export function createId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}
