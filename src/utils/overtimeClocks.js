/** Shared overtime clock ids / labels for panels and ToolsContext. */

const STORAGE_KEY = 'teacher-dashboard.overtime-clocks.v1'

export const OVERTIME_CLOCKS = [
  { id: 'overtime', label: 'Overtime', shortLabel: 'OT' },
  { id: 'tabs-hawaii', label: 'Tabs Hawaii', shortLabel: 'Tabs HI' },
  { id: 'caltech', label: 'Caltech', shortLabel: 'Caltech' },
]

export const OVERTIME_CLOCK_IDS = OVERTIME_CLOCKS.map((clock) => clock.id)

export function createEmptyOvertimeClock() {
  return {
    elapsedMs: 0,
    running: false,
    mode: 'accrue', // accrue | pay
  }
}

export function createEmptyOvertimeState() {
  return Object.fromEntries(
    OVERTIME_CLOCK_IDS.map((id) => [id, createEmptyOvertimeClock()]),
  )
}

function normalizeClock(raw) {
  const empty = createEmptyOvertimeClock()
  if (!raw || typeof raw !== 'object') return empty
  return {
    elapsedMs: Math.max(0, Number(raw.elapsedMs) || 0),
    running: Boolean(raw.running),
    mode: raw.mode === 'pay' ? 'pay' : 'accrue',
    updatedAt: Number(raw.updatedAt) || 0,
  }
}

/** Apply wall-clock catch-up if a clock was running when the page closed. */
function catchUpClock(clock, now = Date.now()) {
  const next = {
    elapsedMs: clock.elapsedMs,
    running: clock.running,
    mode: clock.mode,
  }
  if (!clock.running || !clock.updatedAt) return next

  const delta = Math.max(0, now - clock.updatedAt)
  if (clock.mode === 'pay') {
    const elapsedMs = Math.max(0, clock.elapsedMs - delta)
    return {
      elapsedMs,
      running: elapsedMs > 0,
      mode: elapsedMs > 0 ? 'pay' : 'accrue',
    }
  }
  return {
    ...next,
    elapsedMs: clock.elapsedMs + delta,
  }
}

export function loadOvertimeClocks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyOvertimeState()
    const parsed = JSON.parse(raw)
    const now = Date.now()
    const state = createEmptyOvertimeState()
    for (const id of OVERTIME_CLOCK_IDS) {
      state[id] = catchUpClock(normalizeClock(parsed?.[id]), now)
    }
    return state
  } catch {
    return createEmptyOvertimeState()
  }
}

export function saveOvertimeClocks(clocks) {
  try {
    const now = Date.now()
    const payload = {}
    for (const id of OVERTIME_CLOCK_IDS) {
      const clock = clocks?.[id] || createEmptyOvertimeClock()
      payload[id] = {
        elapsedMs: Math.max(0, Number(clock.elapsedMs) || 0),
        running: Boolean(clock.running),
        mode: clock.mode === 'pay' ? 'pay' : 'accrue',
        updatedAt: now,
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore quota / private mode failures.
  }
}
