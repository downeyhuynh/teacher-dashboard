/**
 * Clamp a number between min and max (inclusive).
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
