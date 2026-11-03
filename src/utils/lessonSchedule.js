/**
 * Wall-clock class periods for Hawaii / Caltech day.
 * Times are local minutes from midnight.
 */

const MON_THU = [
  { subject: 'morning-meeting', label: 'Morning Meeting', start: 8 * 60, end: 8 * 60 + 45 },
  { subject: 'eld', label: 'ELD', start: 8 * 60 + 45, end: 9 * 60 + 15 },
  { subject: 'math', label: 'Math', start: 9 * 60 + 15, end: 11 * 60 + 45 },
  { subject: 'science', label: 'Science', start: 11 * 60 + 45, end: 13 * 60 },
  { subject: 'plg', label: 'PLG', start: 14 * 60, end: 15 * 60 },
]

const FRIDAY = [
  { subject: 'morning-meeting', label: 'Morning Meeting', start: 8 * 60 + 15, end: 8 * 60 + 30 },
  { subject: 'eld', label: 'ELD', start: 8 * 60 + 30, end: 9 * 60 },
  { subject: 'math', label: 'Math', start: 9 * 60, end: 10 * 60 + 40 },
  { subject: 'science', label: 'Science', start: 10 * 60 + 40, end: 11 * 60 + 30 },
]

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes()
}

function formatClock(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const suffix = hours24 >= 12 ? 'pm' : 'am'
  const hours12 = hours24 % 12 || 12
  return minutes === 0
    ? `${hours12} ${suffix}`
    : `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function withRangeLabel(period) {
  return {
    ...period,
    rangeLabel: `${formatClock(period.start)} – ${formatClock(period.end)}`,
  }
}

/** @returns {'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|null} */
export function scheduleWeekday(date = new Date()) {
  const map = {
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
  }
  return map[date.getDay()] || null
}

export function periodsForDate(date = new Date()) {
  const day = date.getDay()
  if (day === 5) return FRIDAY.map(withRangeLabel)
  if (day >= 1 && day <= 4) return MON_THU.map(withRangeLabel)
  return []
}

/**
 * @returns {{ subject: string, label: string, start: number, end: number, rangeLabel: string } | null}
 */
export function getActivePeriod(date = new Date()) {
  const periods = periodsForDate(date)
  if (!periods.length) return null
  const now = minutesOfDay(date)
  for (const period of periods) {
    if (now >= period.start && now < period.end) return period
  }
  return null
}

/**
 * Next period later today, or null.
 */
export function getNextPeriod(date = new Date()) {
  const periods = periodsForDate(date)
  if (!periods.length) return null
  const now = minutesOfDay(date)
  return periods.find((period) => period.start > now) || null
}

/** Local calendar key YYYY-MM-DD */
export function dateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}
