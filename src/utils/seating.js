import { createId } from './id'
import { DEFAULT_CLASS_ID } from './roster'

const STORAGE_KEY = 'teacher-dashboard.seating.v1'
const DEFAULT_TEMPLATE_KEY = 'teacher-dashboard.seating.default-template.v1'

export const DEFAULT_ROOM_NAME = 'Default'

export const ROOM_WORLD = { width: 1400, height: 900 }

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 2
export const ZOOM_STEP = 0.1

export function createEmptyRoom(
  name = DEFAULT_ROOM_NAME,
  classId = DEFAULT_CLASS_ID,
) {
  return {
    id: createId('room'),
    name,
    classId,
    tables: [],
    seats: [],
    items: [],
  }
}

export function createTable(x, y) {
  return {
    id: createId('table'),
    x,
    y,
    width: 140,
    height: 70,
    label: '',
  }
}

export function createSeat(x, y) {
  return {
    id: createId('seat'),
    x,
    y,
    label: '',
    studentName: '',
  }
}

export function createMiscItem(x, y) {
  return {
    id: createId('misc'),
    x,
    y,
    width: 120,
    height: 80,
    label: 'Misc',
  }
}

export function normalizeRoom(room) {
  return {
    ...room,
    tables: Array.isArray(room.tables) ? room.tables : [],
    seats: Array.isArray(room.seats) ? room.seats : [],
    items: Array.isArray(room.items) ? room.items : [],
    classId: room.classId || DEFAULT_CLASS_ID,
    name: room.name || DEFAULT_ROOM_NAME,
  }
}

export function isDefaultRoomName(name) {
  return String(name || '').trim().toLowerCase() === 'default'
}

export function findDefaultRoom(rooms) {
  return (rooms || []).find((room) => isDefaultRoomName(room.name)) || null
}

/** Strip ids so a room can be stored as a reusable default template. */
export function roomToTemplate(room) {
  const normalized = normalizeRoom(room)
  return {
    classId: normalized.classId,
    tables: normalized.tables.map(({ id: _id, ...rest }) => rest),
    seats: normalized.seats.map(({ id: _id, ...rest }) => rest),
    items: normalized.items.map(({ id: _id, ...rest }) => rest),
  }
}

/** Build a live room from a saved default template. */
export function roomFromTemplate(template, name = DEFAULT_ROOM_NAME) {
  if (!template) return createEmptyRoom(name)
  return {
    id: createId('room'),
    name,
    classId: template.classId || DEFAULT_CLASS_ID,
    tables: (template.tables || []).map((table) => ({
      ...table,
      id: createId('table'),
    })),
    seats: (template.seats || []).map((seat) => ({
      ...seat,
      id: createId('seat'),
      studentName: '',
    })),
    items: (template.items || []).map((item) => ({
      ...item,
      id: createId('misc'),
    })),
  }
}

/** Full room clone with fresh ids (keeps student names). */
export function cloneFullRoom(room, name) {
  const normalized = normalizeRoom(room)
  return {
    id: createId('room'),
    name: name || `${normalized.name} copy`,
    classId: normalized.classId,
    tables: normalized.tables.map((table) => ({
      ...table,
      id: createId('table'),
    })),
    seats: normalized.seats.map((seat) => ({
      ...seat,
      id: createId('seat'),
    })),
    items: normalized.items.map((item) => ({
      ...item,
      id: createId('misc'),
    })),
  }
}

export function loadDefaultTemplate() {
  try {
    const raw = localStorage.getItem(DEFAULT_TEMPLATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      classId: parsed.classId || DEFAULT_CLASS_ID,
      tables: Array.isArray(parsed.tables) ? parsed.tables : [],
      seats: Array.isArray(parsed.seats) ? parsed.seats : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
    }
  } catch {
    return null
  }
}

export function saveDefaultTemplate(room) {
  try {
    localStorage.setItem(
      DEFAULT_TEMPLATE_KEY,
      JSON.stringify(roomToTemplate(room)),
    )
  } catch {
    // Ignore quota errors.
  }
}

/**
 * Assign roster names to empty seats. Extra seats stay unnamed.
 * Already-assigned seats are left alone.
 */
export function fillEmptySeats(seats, roster, { shuffle = true } = {}) {
  const available = [...roster].filter(Boolean)
  if (shuffle) {
    for (let i = available.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[available[i], available[j]] = [available[j], available[i]]
    }
  }

  let index = 0
  return seats.map((seat) => {
    if (seat.studentName) return seat
    if (index >= available.length) return { ...seat, studentName: '' }
    const studentName = available[index]
    index += 1
    return { ...seat, studentName }
  })
}

/** Clear seat names, then fill from roster shuffled. */
export function reshuffleSeatNames(seats, roster) {
  const cleared = seats.map((seat) => ({ ...seat, studentName: '' }))
  return fillEmptySeats(cleared, roster, { shuffle: true })
}

export function countEmptySeats(seats) {
  return seats.filter((seat) => !seat.studentName).length
}

function createInitialRooms() {
  const template = loadDefaultTemplate()
  const room = template
    ? roomFromTemplate(template, DEFAULT_ROOM_NAME)
    : createEmptyRoom(DEFAULT_ROOM_NAME)
  return { rooms: [room], activeRoomId: room.id }
}

export function loadSeatingState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialRooms()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.rooms) || !parsed.rooms.length) {
      return createInitialRooms()
    }

    const rooms = parsed.rooms.map(normalizeRoom)
    const defaultRoom = findDefaultRoom(rooms)
    return {
      rooms,
      activeRoomId:
        defaultRoom?.id || parsed.activeRoomId || rooms[0].id,
    }
  } catch {
    return createInitialRooms()
  }
}

export function saveSeatingState(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rooms: state.rooms,
        activeRoomId: state.activeRoomId,
      }),
    )
  } catch {
    // Ignore quota errors.
  }
}

export function clampZoom(value) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100))
}

export const DUPLICATE_OFFSET = 24

export function cloneRoomItems(room, selectedIds, offset = DUPLICATE_OFFSET) {
  const idSet = new Set(selectedIds)
  const newIds = []
  const tables = [...(room.tables || [])]
  const seats = [...(room.seats || [])]
  const items = [...(room.items || [])]

  for (const table of room.tables || []) {
    if (!idSet.has(table.id)) continue
    const copy = {
      ...table,
      id: createId('table'),
      x: table.x + offset,
      y: table.y + offset,
    }
    tables.push(copy)
    newIds.push(copy.id)
  }

  for (const seat of room.seats || []) {
    if (!idSet.has(seat.id)) continue
    const copy = {
      ...seat,
      id: createId('seat'),
      x: seat.x + offset,
      y: seat.y + offset,
    }
    seats.push(copy)
    newIds.push(copy.id)
  }

  for (const item of room.items || []) {
    if (!idSet.has(item.id)) continue
    const copy = {
      ...item,
      id: createId('misc'),
      x: item.x + offset,
      y: item.y + offset,
    }
    items.push(copy)
    newIds.push(copy.id)
  }

  return {
    room: { ...room, tables, seats, items },
    newIds,
  }
}

export const SEAT_SIZE = { width: 52, height: 40 }

export function getItemBounds(item, type) {
  if (type === 'seat') {
    return {
      x: item.x,
      y: item.y,
      width: SEAT_SIZE.width,
      height: SEAT_SIZE.height,
    }
  }
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
  }
}

export function normalizeRect(x0, y0, x1, y1) {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  }
}

export function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/** Collect room item ids whose bounds intersect the marquee rect. */
export function idsInMarquee(room, marquee) {
  if (!room || marquee.width < 2 || marquee.height < 2) return []
  const hits = []
  for (const table of room.tables || []) {
    if (rectsIntersect(marquee, getItemBounds(table, 'table'))) hits.push(table.id)
  }
  for (const item of room.items || []) {
    if (rectsIntersect(marquee, getItemBounds(item, 'misc'))) hits.push(item.id)
  }
  for (const seat of room.seats || []) {
    if (rectsIntersect(marquee, getItemBounds(seat, 'seat'))) hits.push(seat.id)
  }
  return hits
}
