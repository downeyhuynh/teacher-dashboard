/**
 * Parse a display name into sortable last-name parts.
 * Supports "First Last", "Last, First", and single tokens.
 */
export function getLastNameKey(fullName) {
  const name = String(fullName || '').trim()
  if (!name) return ''

  if (name.includes(',')) {
    return name.split(',')[0].trim().toLowerCase()
  }

  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].toLowerCase()
  return parts[parts.length - 1].toLowerCase()
}

export function compareByLastName(a, b) {
  const lastA = getLastNameKey(a)
  const lastB = getLastNameKey(b)
  if (lastA !== lastB) return lastA.localeCompare(lastB)
  return String(a).localeCompare(String(b))
}

/**
 * Build a numbered alphabetical roster from seats that have student names.
 */
export function buildAttendanceList(seats) {
  const named = (seats || [])
    .filter((seat) => String(seat.studentName || '').trim())
    .map((seat) => ({
      seatId: seat.id,
      name: String(seat.studentName).trim(),
      x: seat.x,
      y: seat.y,
    }))

  named.sort((a, b) => compareByLastName(a.name, b.name))

  return named.map((entry, index) => ({
    ...entry,
    number: index + 1,
  }))
}

const STORAGE_KEY = 'teacher-dashboard.attendance.v1'

function todayKey() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function sessionKey(roomId, date = todayKey()) {
  return `${roomId}:${date}`
}

export function loadAttendanceState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { roomId: '', marksBySession: {} }
    const parsed = JSON.parse(raw)
    return {
      roomId: typeof parsed?.roomId === 'string' ? parsed.roomId : '',
      marksBySession:
        parsed?.marksBySession && typeof parsed.marksBySession === 'object'
          ? parsed.marksBySession
          : {},
    }
  } catch {
    return { roomId: '', marksBySession: {} }
  }
}

export function saveAttendanceState(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        roomId: state.roomId || '',
        marksBySession: state.marksBySession || {},
      }),
    )
  } catch {
    // Ignore quota errors.
  }
}

export function getMarkedIdsForRoom(marksBySession, roomId) {
  if (!roomId) return []
  const key = sessionKey(roomId)
  const ids = marksBySession?.[key]
  return Array.isArray(ids) ? ids.map(String) : []
}

export function setMarkedIdsForRoom(marksBySession, roomId, markedIds) {
  if (!roomId) return { ...(marksBySession || {}) }
  const next = { ...(marksBySession || {}) }
  const key = sessionKey(roomId)
  const ids = [...markedIds]
  if (!ids.length) {
    delete next[key]
  } else {
    next[key] = ids
  }
  return next
}
