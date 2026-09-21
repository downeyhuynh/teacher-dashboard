/** Shared overtime clock ids / labels for panels and ToolsContext. */
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
