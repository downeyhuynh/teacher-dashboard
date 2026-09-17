import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSeating } from '../context/SeatingContext'
import { useTools } from '../context/ToolsContext'
import { ZoomInIcon, ZoomOutIcon } from '../components/ui/icons'
import { usePortalRoot } from '../hooks/usePortalRoot'
import {
  ROOM_WORLD,
  SEAT_SIZE,
  ZOOM_STEP,
  clampZoom,
  countEmptySeats,
  idsInMarquee,
  normalizeRect,
} from '../utils/seating'

/**
 * Classroom seating chart: tables, seats, misc blocks, zoom, fullscreen.
 */
export function SeatingChartPanel() {
  const {
    rooms,
    activeRoom,
    tool,
    selectedIds,
    selectedIdSet,
    selectedId,
    selectedItem,
    classOptions,
    setTool,
    selectOnly,
    toggleSelected,
    setSelection,
    clearSelection,
    selectRoom,
    addRoom,
    renameRoom,
    saveRoom,
    saveRoomName,
    duplicateRoom,
    reshuffleNames,
    setRoomClass,
    clearRoom,
    deleteRoom,
    placeTable,
    placeSeat,
    placeMisc,
    moveItemsByDelta,
    resizeItem,
    updateItem,
    updateSelected,
    deleteSelected,
    duplicateSelected,
    pushUndo,
    undo,
    fillSeatsFromRoster,
    clearSeatNames,
  } = useSeating()

  const { picker } = useTools()
  const roster = picker.rosters[activeRoom?.classId] || []

  const viewportRef = useRef(null)
  const dragRef = useRef(null)
  const selectedIdsRef = useRef(selectedIds)
  const renameInputRef = useRef(null)

  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const portalRoot = usePortalRoot()
  const [fillOpen, setFillOpen] = useState(false)
  const [fillClassId, setFillClassId] = useState('')
  const [fillShuffle, setFillShuffle] = useState(true)
  const [saveNote, setSaveNote] = useState('')
  const [marquee, setMarquee] = useState(null)
  const [renaming, setRenaming] = useState(null) // { id, type, value }

  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

  useEffect(() => {
    if (!fillOpen || !activeRoom) return
    setFillClassId(activeRoom.classId)
  }, [fillOpen, activeRoom])

  useEffect(() => {
    if (!renaming?.id) return undefined
    const id = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [renaming?.id])

  useEffect(() => {
    const isTypingTarget = (target) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable
      )
    }

    const onKey = (event) => {
      if (event.key === 'Escape') {
        if (renaming) {
          setRenaming(null)
          return
        }
        if (isFullscreen) {
          setIsFullscreen(false)
        }
        return
      }

      if (isTypingTarget(event.target)) return

      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        duplicateSelected()
        return
      }
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
        return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        if (!selectedIdsRef.current.length) return
        event.preventDefault()
        deleteSelected()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelected, duplicateSelected, isFullscreen, renaming, undo])

  if (!activeRoom) return null

  const emptySeatCount = countEmptySeats(activeRoom.seats)

  const collectOrigins = (ids) => {
    const idSet = new Set(ids)
    const origins = []
    for (const table of activeRoom.tables) {
      if (idSet.has(table.id)) origins.push({ id: table.id, x: table.x, y: table.y })
    }
    for (const item of activeRoom.items) {
      if (idSet.has(item.id)) origins.push({ id: item.id, x: item.x, y: item.y })
    }
    for (const seat of activeRoom.seats) {
      if (idSet.has(seat.id)) origins.push({ id: seat.id, x: seat.x, y: seat.y })
    }
    return origins
  }

  const pointerToWorld = (clientX, clientY) => {
    const viewport = viewportRef.current
    if (!viewport) return { x: 0, y: 0 }
    const rect = viewport.getBoundingClientRect()
    return {
      x: (clientX - rect.left + viewport.scrollLeft) / zoom,
      y: (clientY - rect.top + viewport.scrollTop) / zoom,
    }
  }

  const onWorldPointerDown = (event) => {
    if (event.target !== event.currentTarget) return
    const point = pointerToWorld(event.clientX, event.clientY)

    if (tool === 'table') {
      placeTable(point.x, point.y)
      return
    }
    if (tool === 'seat') {
      placeSeat(point.x, point.y)
      return
    }
    if (tool === 'misc') {
      placeMisc(point.x, point.y)
      return
    }

    // Marquee / clear selection
    if (!event.shiftKey) clearSelection()
    dragRef.current = {
      mode: 'marquee',
      startX: point.x,
      startY: point.y,
      additive: event.shiftKey,
      baseIds: event.shiftKey ? [...selectedIdsRef.current] : [],
      pointerId: event.pointerId,
    }
    setMarquee(normalizeRect(point.x, point.y, point.x, point.y))
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleItemDown = (event, item, type) => {
    event.stopPropagation()
    if (renaming) return

    if (tool !== 'select') {
      selectOnly(item.id)
      return
    }

    if (event.shiftKey) {
      toggleSelected(item.id)
      return
    }

    const alreadyInSelection = selectedIdsRef.current.includes(item.id)
    const ids = alreadyInSelection ? [...selectedIdsRef.current] : [item.id]
    if (!alreadyInSelection) selectOnly(item.id)

    const point = pointerToWorld(event.clientX, event.clientY)
    dragRef.current = {
      mode: 'move',
      startX: point.x,
      startY: point.y,
      origins: collectOrigins(ids),
      historyPushed: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const startRename = (item, type) => {
    dragRef.current = null
    pushUndo()
    selectOnly(item.id)
    const value =
      type === 'seat'
        ? item.studentName || item.label || ''
        : item.label || ''
    setRenaming({ id: item.id, type, value })
  }

  const commitRename = () => {
    if (!renaming) return
    const next = renaming.value.trim()
    if (renaming.type === 'seat') {
      updateItem(renaming.id, { studentName: next })
    } else {
      updateItem(renaming.id, { label: next })
    }
    setRenaming(null)
  }

  const handleItemDoubleClick = (event, item, type) => {
    event.stopPropagation()
    event.preventDefault()
    startRename(item, type)
  }

  const handleResizeDown = (event, item) => {
    event.stopPropagation()
    selectOnly(item.id)
    dragRef.current = {
      mode: 'resize',
      id: item.id,
      startX: item.x,
      startY: item.y,
      historyPushed: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (!dragRef.current) return
    const point = pointerToWorld(event.clientX, event.clientY)

    if (dragRef.current.mode === 'marquee') {
      const next = normalizeRect(
        dragRef.current.startX,
        dragRef.current.startY,
        point.x,
        point.y,
      )
      setMarquee(next)
      const hits = idsInMarquee(activeRoom, next)
      if (dragRef.current.additive) {
        setSelection([...dragRef.current.baseIds, ...hits])
      } else {
        setSelection(hits)
      }
      return
    }

    if (dragRef.current.mode === 'move') {
      const dx = point.x - dragRef.current.startX
      const dy = point.y - dragRef.current.startY
      if (
        !dragRef.current.historyPushed &&
        (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)
      ) {
        pushUndo()
        dragRef.current.historyPushed = true
      }
      moveItemsByDelta(dragRef.current.origins, dx, dy)
      return
    }

    if (dragRef.current.mode === 'resize') {
      if (!dragRef.current.historyPushed) {
        pushUndo()
        dragRef.current.historyPushed = true
      }
      const width = Math.max(40, point.x - dragRef.current.startX)
      const height = Math.max(28, point.y - dragRef.current.startY)
      resizeItem(dragRef.current.id, width, height)
    }
  }

  const endDrag = () => {
    dragRef.current = null
    setMarquee(null)
  }

  const handleSave = () => {
    saveRoom()
    setSaveNote('Saved as Default loadout.')
    setFillOpen(true)
    window.setTimeout(() => setSaveNote(''), 2400)
  }

  const applyFill = () => {
    if (!fillClassId) {
      setFillOpen(false)
      return
    }
    const names = picker.rosters[fillClassId] || []
    fillSeatsFromRoster(names, { shuffle: fillShuffle })
    setRoomClass(fillClassId)
    setFillOpen(false)
  }

  const zoomIn = () => setZoom((value) => clampZoom(value + ZOOM_STEP))
  const zoomOut = () => setZoom((value) => clampZoom(value - ZOOM_STEP))
  const zoomReset = () => setZoom(1)

  const hint =
    tool === 'table'
      ? 'Click the room to place a table.'
      : tool === 'seat'
        ? 'Click the room to place a student seat.'
        : tool === 'misc'
          ? 'Click to place a misc block, then drag the corner to resize.'
          : 'Shift-click or box-select. Ctrl+D duplicate, Backspace delete, Ctrl+Z undo. Double-click to rename.'

  const selectionCount = selectedIds.length
  const showResize =
    tool === 'select' && selectedId && selectedItem && selectedItem.type !== 'seat'

  const panel = (
    <div className={`seating-panel ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <div className="seating-panel__toolbar">
        <select
          className="seating-panel__select"
          value={activeRoom.id}
          onChange={(event) => selectRoom(event.target.value)}
          aria-label="Active room"
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
        <button type="button" className="stage-button" onClick={addRoom}>
          New room
        </button>
        <button type="button" className="stage-button" onClick={duplicateRoom}>
          Duplicate room
        </button>
        <button
          type="button"
          className="stage-button stage-button--danger"
          onClick={() => {
            if (rooms.length <= 1) return
            if (
              !window.confirm(
                `Delete room “${activeRoom.name || 'Untitled'}”? This cannot be undone from here.`,
              )
            ) {
              return
            }
            deleteRoom()
          }}
          disabled={rooms.length <= 1}
          title={
            rooms.length <= 1
              ? 'Keep at least one room'
              : 'Delete this room'
          }
        >
          Delete room
        </button>
        <button type="button" className="stage-button stage-button--primary" onClick={handleSave}>
          Save room
        </button>
        {saveNote && <span className="seating-panel__note">{saveNote}</span>}
      </div>

      <div className="seating-panel__fields">
        <label className="seating-panel__field">
          <span>Room name</span>
          <div className="seating-panel__name-row">
            <input
              type="text"
              value={activeRoom.name}
              onChange={(event) => renameRoom(event.target.value)}
              placeholder="Default"
            />
            <button
              type="button"
              className="stage-button"
              onClick={() => {
                saveRoomName()
                setSaveNote('Room name saved.')
                window.setTimeout(() => setSaveNote(''), 2000)
              }}
            >
              Save name
            </button>
          </div>
        </label>
        <label className="seating-panel__field">
          <span>Class roster</span>
          <div className="seating-panel__name-row">
            <select
              value={activeRoom.classId}
              onChange={(event) => setRoomClass(event.target.value)}
            >
              {classOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="stage-button stage-button--primary"
              onClick={() => fillSeatsFromRoster(roster, { shuffle: true })}
              disabled={!activeRoom.seats.length || !roster.length}
              title="Assign random students from this class to empty seats"
            >
              Add random students
            </button>
            <button
              type="button"
              className="stage-button"
              onClick={() => reshuffleNames(roster)}
              disabled={!activeRoom.seats.length || !roster.length}
              title="Randomly reassign this class roster to all seats"
            >
              Reshuffle names
            </button>
          </div>
        </label>
      </div>

      <div className="seating-panel__tools" role="toolbar" aria-label="Seating tools">
        <button
          type="button"
          className={`tool-chip ${tool === 'select' ? 'is-active' : ''}`}
          onClick={() => setTool('select')}
        >
          Move
        </button>
        <button
          type="button"
          className={`tool-chip ${tool === 'table' ? 'is-active' : ''}`}
          onClick={() => setTool('table')}
        >
          Add table
        </button>
        <button
          type="button"
          className={`tool-chip ${tool === 'seat' ? 'is-active' : ''}`}
          onClick={() => setTool('seat')}
        >
          Place seat
        </button>
        <button
          type="button"
          className="stage-button"
          onClick={() => {
            const count = activeRoom.seats.length
            const col = count % 8
            const row = Math.floor(count / 8)
            placeSeat(70 + col * 62, 80 + row * 50)
          }}
        >
          Add seat
        </button>
        <button
          type="button"
          className={`tool-chip ${tool === 'misc' ? 'is-active' : ''}`}
          onClick={() => setTool('misc')}
        >
          Add misc
        </button>
        <button
          type="button"
          className="stage-button stage-button--danger"
          disabled={!selectionCount}
          onClick={deleteSelected}
        >
          Delete{selectionCount > 1 ? ` (${selectionCount})` : ''}
        </button>
        <button type="button" className="stage-button" onClick={clearRoom}>
          Clear room
        </button>
      </div>

      <div className="seating-panel__viewbar">
        <p className="tool-panel__hint seating-panel__hint">{hint}</p>
        <div className="seating-panel__zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            className="stage-button stage-button--icon"
            aria-label="Zoom out"
            onClick={zoomOut}
          >
            <ZoomOutIcon className="stage-button__icon" />
          </button>
          <button type="button" className="stage-button" onClick={zoomReset}>
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="stage-button stage-button--icon"
            aria-label="Zoom in"
            onClick={zoomIn}
          >
            <ZoomInIcon className="stage-button__icon" />
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

      <div ref={viewportRef} className="seating-canvas-viewport">
        <div
          className="seating-canvas-scaler"
          style={{
            width: ROOM_WORLD.width * zoom,
            height: ROOM_WORLD.height * zoom,
          }}
        >
          <div
            className={`seating-canvas seating-canvas--${tool}`}
            style={{
              width: ROOM_WORLD.width,
              height: ROOM_WORLD.height,
              transform: `scale(${zoom})`,
            }}
            onPointerDown={onWorldPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {activeRoom.tables.map((table) => (
              <div
                key={table.id}
                className={`seating-table ${
                  selectedIdSet.has(table.id) ? 'is-selected' : ''
                }`}
                style={{
                  left: table.x,
                  top: table.y,
                  width: table.width,
                  height: table.height,
                }}
                onPointerDown={(event) => handleItemDown(event, table, 'table')}
                onDoubleClick={(event) => handleItemDoubleClick(event, table, 'table')}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                {renaming?.id === table.id ? (
                  <input
                    ref={renameInputRef}
                    className="seating-rename"
                    value={renaming.value}
                    aria-label="Rename table"
                    onChange={(event) =>
                      setRenaming((prev) =>
                        prev ? { ...prev, value: event.target.value } : prev,
                      )
                    }
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitRename()
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setRenaming(null)
                      }
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                ) : (
                  <span className="seating-table__label">{table.label || 'Table'}</span>
                )}
                {showResize && selectedId === table.id && !renaming && (
                  <span
                    className="seating-resize"
                    onPointerDown={(event) => handleResizeDown(event, table)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  />
                )}
              </div>
            ))}

            {activeRoom.items.map((item) => (
              <div
                key={item.id}
                className={`seating-misc ${
                  selectedIdSet.has(item.id) ? 'is-selected' : ''
                }`}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                }}
                onPointerDown={(event) => handleItemDown(event, item, 'misc')}
                onDoubleClick={(event) => handleItemDoubleClick(event, item, 'misc')}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                {renaming?.id === item.id ? (
                  <input
                    ref={renameInputRef}
                    className="seating-rename"
                    value={renaming.value}
                    aria-label="Rename misc item"
                    onChange={(event) =>
                      setRenaming((prev) =>
                        prev ? { ...prev, value: event.target.value } : prev,
                      )
                    }
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitRename()
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setRenaming(null)
                      }
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                ) : (
                  <span className="seating-misc__label">{item.label || 'Misc'}</span>
                )}
                {showResize && selectedId === item.id && !renaming && (
                  <span
                    className="seating-resize"
                    onPointerDown={(event) => handleResizeDown(event, item)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  />
                )}
              </div>
            ))}

            {activeRoom.seats.map((seat) => (
              <div
                key={seat.id}
                className={`seating-seat ${
                  selectedIdSet.has(seat.id) ? 'is-selected' : ''
                } ${seat.studentName ? '' : 'is-empty'}`}
                style={{
                  left: seat.x,
                  top: seat.y,
                  width: SEAT_SIZE.width,
                  height: SEAT_SIZE.height,
                }}
                title={seat.studentName || seat.label || 'Seat (no name)'}
                onPointerDown={(event) => handleItemDown(event, seat, 'seat')}
                onDoubleClick={(event) => handleItemDoubleClick(event, seat, 'seat')}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                {renaming?.id === seat.id ? (
                  <input
                    ref={renameInputRef}
                    className="seating-rename seating-rename--seat"
                    value={renaming.value}
                    aria-label="Rename seat"
                    onChange={(event) =>
                      setRenaming((prev) =>
                        prev ? { ...prev, value: event.target.value } : prev,
                      )
                    }
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitRename()
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setRenaming(null)
                      }
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                ) : (
                  <span className="seating-seat__name">
                    {seat.studentName || seat.label || '•'}
                  </span>
                )}
              </div>
            ))}

            {marquee && (
              <div
                className="seating-marquee"
                style={{
                  left: marquee.x,
                  top: marquee.y,
                  width: marquee.width,
                  height: marquee.height,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {selectionCount > 1 && (
        <p className="seating-panel__multi">
          {selectionCount} items selected — Ctrl+D duplicate, Backspace delete, Ctrl+Z undo.
        </p>
      )}

      {selectedItem && selectionCount === 1 && !renaming && (
        <div className="seating-panel__inspector">
          <span className="tool-panel__label">
            {selectedItem.type === 'table'
              ? 'Table'
              : selectedItem.type === 'misc'
                ? 'Misc item'
                : 'Seat'}
          </span>
          <label className="seating-panel__field">
            <span>Label</span>
            <input
              type="text"
              value={selectedItem.label || ''}
              placeholder={
                selectedItem.type === 'table'
                  ? 'e.g. Group A'
                  : selectedItem.type === 'misc'
                    ? 'e.g. Carpet / Supplies'
                    : 'e.g. Desk 3'
              }
              onFocus={pushUndo}
              onChange={(event) => updateSelected({ label: event.target.value })}
            />
          </label>
          {selectedItem.type === 'seat' && (
            <label className="seating-panel__field">
              <span>Student</span>
              <select
                value={selectedItem.studentName || ''}
                onFocus={pushUndo}
                onChange={(event) =>
                  updateSelected({ studentName: event.target.value })
                }
              >
                <option value="">No name</option>
                {roster.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {fillOpen && (
        <div className="seating-fill" role="dialog" aria-label="Fill empty seats">
          <div className="seating-fill__card">
            <h3 className="seating-fill__title">Fill empty seats?</h3>
            <p className="seating-fill__copy">
              Layout saved. {emptySeatCount} empty seat
              {emptySeatCount === 1 ? '' : 's'} can be filled from a roster.
              Extra seats stay with no name.
            </p>
            <label className="seating-panel__field">
              <span>Roster</span>
              <select
                value={fillClassId}
                onChange={(event) => setFillClassId(event.target.value)}
              >
                <option value="">No names — leave empty</option>
                {classOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="seating-fill__check">
              <input
                type="checkbox"
                checked={fillShuffle}
                onChange={(event) => setFillShuffle(event.target.checked)}
                disabled={!fillClassId}
              />
              Shuffle names
            </label>
            <div className="seating-fill__actions">
              <button type="button" className="stage-button" onClick={() => setFillOpen(false)}>
                Skip
              </button>
              <button
                type="button"
                className="stage-button"
                onClick={() => {
                  clearSeatNames()
                  setFillOpen(false)
                }}
              >
                Clear all names
              </button>
              <button
                type="button"
                className="stage-button stage-button--primary"
                onClick={applyFill}
              >
                {fillClassId ? 'Fill seats' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (isFullscreen && portalRoot) {
    return createPortal(
      <div className="seating-fullscreen-root">{panel}</div>,
      portalRoot,
    )
  }

  return panel
}
