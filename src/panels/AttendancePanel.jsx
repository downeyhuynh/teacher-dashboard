import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSeating } from '../context/SeatingContext'
import {
  buildAttendanceList,
  getMarkedIdsForRoom,
  loadAttendanceState,
  saveAttendanceState,
  setMarkedIdsForRoom,
} from '../utils/attendance'
import { ROOM_WORLD, SEAT_SIZE, normalizeRoom } from '../utils/seating'

/**
 * Take attendance on a saved seating chart.
 * Marks persist in browser localStorage (per room, for today).
 */
export function AttendancePanel() {
  const { rooms, activeRoomId } = useSeating()
  const stored = useMemo(() => loadAttendanceState(), [])

  const initialRoomId =
    (stored.roomId && rooms.some((room) => room.id === stored.roomId)
      ? stored.roomId
      : null) ||
    activeRoomId ||
    rooms[0]?.id ||
    ''

  const [roomId, setRoomId] = useState(initialRoomId)
  const [marksBySession, setMarksBySession] = useState(
    () => stored.marksBySession || {},
  )
  const [isFullscreen, setIsFullscreen] = useState(false)

  const room = useMemo(() => {
    const found = rooms.find((entry) => entry.id === roomId) || rooms[0]
    return found ? normalizeRoom(found) : null
  }, [rooms, roomId])

  const effectiveRoomId = room?.id || ''

  const markedIds = useMemo(
    () => new Set(getMarkedIdsForRoom(marksBySession, effectiveRoomId)),
    [marksBySession, effectiveRoomId],
  )

  const list = useMemo(
    () => (room ? buildAttendanceList(room.seats) : []),
    [room],
  )

  useEffect(() => {
    saveAttendanceState({
      roomId: effectiveRoomId,
      marksBySession,
    })
  }, [effectiveRoomId, marksBySession])

  useEffect(() => {
    if (!isFullscreen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const markedCount = markedIds.size

  const toggleSeat = (seatId) => {
    setMarksBySession((prev) => {
      const current = new Set(getMarkedIdsForRoom(prev, effectiveRoomId))
      if (current.has(seatId)) current.delete(seatId)
      else current.add(seatId)
      return setMarkedIdsForRoom(prev, effectiveRoomId, current)
    })
  }

  const clearMarks = () => {
    setMarksBySession((prev) =>
      setMarkedIdsForRoom(prev, effectiveRoomId, new Set()),
    )
  }

  if (!room) {
    return (
      <div className="attendance-panel">
        <p className="tool-panel__hint">
          Create a seating chart first, then take attendance here. Marks save in this
          browser automatically.
        </p>
      </div>
    )
  }

  const panel = (
    <div className={`attendance-panel ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <div className="attendance-panel__toolbar">
        <label className="attendance-panel__field">
          <span>Seating chart</span>
          <select
            value={room.id}
            onChange={(event) => setRoomId(event.target.value)}
            aria-label="Choose seating chart"
          >
            {rooms.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <div className="attendance-panel__stats">
          <span>
            Marked {markedCount} / {list.length}
          </span>
          <button
            type="button"
            className="stage-button"
            onClick={clearMarks}
            disabled={!markedCount}
          >
            Clear marks
          </button>
          <button
            type="button"
            className="stage-button"
            onClick={() => setIsFullscreen((value) => !value)}
          >
            {isFullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
      </div>

      <p className="tool-panel__hint attendance-panel__hint">
        Click a student on the chart (or in the list) to mark them red. Saved in this
        browser for today. List is numbered A–Z by last name.
      </p>

      <div className="attendance-panel__body">
        <div className="attendance-canvas-viewport">
          <div
            className="attendance-canvas"
            style={{ width: ROOM_WORLD.width, height: ROOM_WORLD.height }}
          >
            {room.tables.map((table) => (
              <div
                key={table.id}
                className="seating-table attendance-table"
                style={{
                  left: table.x,
                  top: table.y,
                  width: table.width,
                  height: table.height,
                }}
              >
                <span className="seating-table__label">{table.label || 'Table'}</span>
              </div>
            ))}

            {room.items.map((item) => (
              <div
                key={item.id}
                className="seating-misc attendance-misc"
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                }}
              >
                <span className="seating-misc__label">{item.label || 'Misc'}</span>
              </div>
            ))}

            {room.seats.map((seat) => {
              const name = String(seat.studentName || '').trim()
              const isMarked = markedIds.has(seat.id)
              const canMark = Boolean(name)

              return (
                <button
                  key={seat.id}
                  type="button"
                  className={`attendance-seat ${isMarked ? 'is-marked' : ''} ${
                    name ? '' : 'is-empty'
                  }`}
                  style={{
                    left: seat.x,
                    top: seat.y,
                    width: SEAT_SIZE.width,
                    height: SEAT_SIZE.height,
                  }}
                  disabled={!canMark}
                  title={name || seat.label || 'Empty seat'}
                  onClick={() => canMark && toggleSeat(seat.id)}
                >
                  <span className="attendance-seat__name">{name || seat.label || '•'}</span>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="attendance-list" aria-label="Attendance roster">
          <h3 className="attendance-list__title">Roster</h3>
          {list.length === 0 ? (
            <p className="attendance-list__empty">No named seats in this chart.</p>
          ) : (
            <ol className="attendance-list__items">
              {list.map((entry) => {
                const isMarked = markedIds.has(entry.seatId)
                return (
                  <li key={entry.seatId}>
                    <button
                      type="button"
                      className={`attendance-list__row ${isMarked ? 'is-marked' : ''}`}
                      onClick={() => toggleSeat(entry.seatId)}
                    >
                      <span className="attendance-list__num">{entry.number}.</span>
                      <span className="attendance-list__name">{entry.name}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </aside>
      </div>
    </div>
  )

  if (isFullscreen) {
    return createPortal(
      <div className="attendance-fullscreen-root">{panel}</div>,
      document.body,
    )
  }

  return panel
}
