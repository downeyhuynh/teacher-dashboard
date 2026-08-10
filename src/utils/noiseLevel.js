const STORAGE_KEY = 'teacher-dashboard.noise-level.v1'

export const NOISE_LEVELS = [
  {
    id: 1,
    theme: 'Library',
    title: 'Level 1 — Library',
    cue: 'Silent work',
    description: 'Voices off. Quiet focus like a library.',
    voice: 'No talking',
  },
  {
    id: 2,
    theme: 'Restaurant',
    title: 'Level 2 — Restaurant',
    cue: 'Soft voices',
    description: 'Low conversation with your group, like a calm restaurant.',
    voice: 'Quiet talking',
  },
  {
    id: 3,
    theme: 'Coffee shop',
    title: 'Level 3 — Coffee shop',
    cue: 'Collaborative buzz',
    description: 'Friendly working noise — share ideas, keep it respectful.',
    voice: 'Table talk OK',
  },
]

export function loadNoiseLevel() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const value = Number(raw)
    if (value === 1 || value === 2 || value === 3) return value
  } catch {
    // Ignore storage errors.
  }
  return 1
}

export function saveNoiseLevel(level) {
  try {
    localStorage.setItem(STORAGE_KEY, String(level))
  } catch {
    // Ignore quota errors.
  }
}

export function getNoiseLevel(levelId) {
  return NOISE_LEVELS.find((level) => level.id === levelId) || NOISE_LEVELS[0]
}
