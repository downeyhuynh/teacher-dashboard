export const PANEL_IDS = {
  TIMER: 'timer',
  ANNOTATE: 'annotate',
  CALCULATOR: 'calculator',
  STUDENTS: 'students',
}

export const DEFAULT_PANEL_SIZE = {
  width: 360,
  height: 280,
}

/** Staggered default origins so panels don't stack perfectly. */
export const PANEL_DEFAULT_ORIGINS = {
  [PANEL_IDS.TIMER]: { x: 48, y: 48 },
  [PANEL_IDS.ANNOTATE]: { x: 88, y: 88 },
  [PANEL_IDS.CALCULATOR]: { x: 168, y: 168 },
  [PANEL_IDS.STUDENTS]: { x: 72, y: 120 },
}

export const PANEL_DEFAULT_SIZES = {
  [PANEL_IDS.TIMER]: { width: 340, height: 480 },
  [PANEL_IDS.ANNOTATE]: { width: 320, height: 340 },
  [PANEL_IDS.CALCULATOR]: { width: 300, height: 420 },
  [PANEL_IDS.STUDENTS]: { width: 380, height: 620 },
}
