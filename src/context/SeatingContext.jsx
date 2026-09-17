import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  cloneFullRoom,
  cloneRoomItems,
  createEmptyRoom,
  createMiscItem,
  createSeat,
  createTable,
  DEFAULT_ROOM_NAME,
  fillEmptySeats,
  loadSeatingState,
  normalizeRoom,
  reshuffleSeatNames,
  roomFromTemplate,
  saveDefaultTemplate,
  saveSeatingState,
  loadDefaultTemplate,
} from '../utils/seating'
import { useTools } from './ToolsContext'

const SeatingContext = createContext(null)
const MAX_UNDO = 60

function updateActiveRoom(rooms, activeRoomId, updater) {
  return rooms.map((room) => {
    if (room.id !== activeRoomId) return room
    return updater(room)
  })
}

function mapSizedItems(list, id, patch) {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

function mapByIdSet(list, ids, patcher) {
  const idSet = ids instanceof Set ? ids : new Set(ids)
  return list.map((item) => (idSet.has(item.id) ? patcher(item) : item))
}

function cloneSnapshot(rooms, activeRoomId, selectedIds) {
  return {
    rooms: JSON.parse(JSON.stringify(rooms)),
    activeRoomId,
    selectedIds: [...selectedIds],
  }
}

export function SeatingProvider({ children }) {
  const { picker } = useTools()
  const classOptions = picker.classOptions

  const initial = loadSeatingState()
  const [rooms, setRooms] = useState(initial.rooms)
  const [activeRoomId, setActiveRoomId] = useState(initial.activeRoomId)
  const [tool, setTool] = useState('select') // select | table | seat | misc
  const [selectedIds, setSelectedIds] = useState([])

  const historyRef = useRef([])
  const stateRef = useRef({
    rooms: initial.rooms,
    activeRoomId: initial.activeRoomId,
    selectedIds: [],
  })

  useEffect(() => {
    stateRef.current = { rooms, activeRoomId, selectedIds }
  }, [rooms, activeRoomId, selectedIds])

  useEffect(() => {
    saveSeatingState({ rooms, activeRoomId })
  }, [rooms, activeRoomId])

  const activeRoom = useMemo(() => {
    const room = rooms.find((entry) => entry.id === activeRoomId) || rooms[0]
    return room ? normalizeRoom(room) : null
  }, [rooms, activeRoomId])

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const pushUndo = useCallback(() => {
    const snap = stateRef.current
    historyRef.current.push(
      cloneSnapshot(snap.rooms, snap.activeRoomId, snap.selectedIds),
    )
    if (historyRef.current.length > MAX_UNDO) {
      historyRef.current.shift()
    }
  }, [])

  const undo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return false
    setRooms(prev.rooms)
    setActiveRoomId(prev.activeRoomId)
    setSelectedIds(prev.selectedIds)
    return true
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  const selectOnly = useCallback((id) => {
    setSelectedIds(id ? [id] : [])
  }, [])

  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((entry) => entry !== id)
      return [...prev, id]
    })
  }, [])

  const setSelection = useCallback((ids) => {
    setSelectedIds([...new Set(ids)])
  }, [])

  const selectRoom = useCallback((roomId) => {
    setActiveRoomId(roomId)
    setSelectedIds([])
    setTool('select')
  }, [])

  const addRoom = useCallback(() => {
    pushUndo()
    const template = loadDefaultTemplate()
    const room = template
      ? roomFromTemplate(template, `Room ${rooms.length + 1}`)
      : createEmptyRoom(`Room ${rooms.length + 1}`)
    setRooms((prev) => [...prev, room])
    setActiveRoomId(room.id)
    setSelectedIds([])
  }, [pushUndo, rooms.length])

  const renameRoom = useCallback(
    (name) => {
      setRooms((prev) =>
        updateActiveRoom(prev, activeRoomId, (room) => ({ ...room, name })),
      )
    },
    [activeRoomId],
  )

  /** Persist layout as the Default open loadout (room renamed to Default). */
  const saveRoom = useCallback(() => {
    if (!activeRoom) return
    const nextRooms = rooms.map((room) => {
      if (room.id !== activeRoomId) return room
      return { ...room, name: DEFAULT_ROOM_NAME }
    })
    const savedRoom = nextRooms.find((room) => room.id === activeRoomId)
    setRooms(nextRooms)
    saveDefaultTemplate(savedRoom)
    saveSeatingState({ rooms: nextRooms, activeRoomId })
  }, [activeRoom, activeRoomId, rooms])

  /** Save the typed room name without changing the Default template. */
  const saveRoomName = useCallback(() => {
    if (!activeRoom) return
    const name = (activeRoom.name || '').trim() || DEFAULT_ROOM_NAME
    const nextRooms = rooms.map((room) => {
      if (room.id !== activeRoomId) return room
      return { ...room, name }
    })
    setRooms(nextRooms)
    saveSeatingState({ rooms: nextRooms, activeRoomId })
  }, [activeRoom, activeRoomId, rooms])

  const duplicateRoom = useCallback(() => {
    if (!activeRoom) return
    pushUndo()
    const baseName = (activeRoom.name || DEFAULT_ROOM_NAME).trim() || DEFAULT_ROOM_NAME
    const copy = cloneFullRoom(activeRoom, `${baseName} copy`)
    setRooms((prev) => [...prev, copy])
    setActiveRoomId(copy.id)
    setSelectedIds([])
  }, [activeRoom, pushUndo])

  const reshuffleNames = useCallback(
    (roster) => {
      pushUndo()
      setRooms((prev) =>
        updateActiveRoom(prev, activeRoomId, (room) => ({
          ...room,
          seats: reshuffleSeatNames(room.seats || [], roster || []),
        })),
      )
    },
    [activeRoomId, pushUndo],
  )

  const setRoomClass = useCallback(
    (classId) => {
      setRooms((prev) =>
        updateActiveRoom(prev, activeRoomId, (room) => ({ ...room, classId })),
      )
    },
    [activeRoomId],
  )

  const clearRoom = useCallback(() => {
    pushUndo()
    setRooms((prev) =>
      updateActiveRoom(prev, activeRoomId, (room) => ({
        ...room,
        tables: [],
        seats: [],
        items: [],
      })),
    )
    setSelectedIds([])
  }, [activeRoomId, pushUndo])

  const deleteRoom = useCallback(() => {
    if (rooms.length <= 1) return
    pushUndo()
    const remaining = rooms.filter((room) => room.id !== activeRoomId)
    const nextActiveId = remaining[0]?.id
    if (!nextActiveId) return
    setRooms(remaining)
    setActiveRoomId(nextActiveId)
    setSelectedIds([])
    setTool('select')
  }, [activeRoomId, pushUndo, rooms])

  const persistNow = useCallback(() => {
    saveSeatingState({ rooms, activeRoomId })
  }, [rooms, activeRoomId])

  const placeTable = useCallback(
    (x, y) => {
      pushUndo()
      const table = createTable(Math.max(0, x - 70), Math.max(0, y - 35))
      setRooms((prev) =>
        updateActiveRoom(prev, activeRoomId, (room) => ({
          ...room,
          tables: [...(room.tables || []), table],
        })),
      )
      setSelectedIds([table.id])
      setTool('select')
    },
    [activeRoomId, pushUndo],
  )

  const placeSeat = useCallback(
    (x, y) => {
      pushUndo()
      const seat = createSeat(Math.max(0, x - 26), Math.max(0, y - 20))
      setRooms((prev) =>
        updateActiveRoom(prev, activeRoomId, (room) => ({
          ...room,
          seats: [...(room.seats || []), seat],
        })),
      )
      setSelectedIds([seat.id])
      setTool('select')
    },
    [activeRoomId, pushUndo],
  )

  const placeMisc = useCallback(
    (x, y) => {
      pushUndo()
      const item = createMiscItem(Math.max(0, x - 60), Math.max(0, y - 40))
      setRooms((prev) =>
        updateActiveRoom(prev, activeRoomId, (room) => ({
          ...room,
          items: [...(room.items || []), item],
        })),
      )
      setSelectedIds([item.id])
      setTool('select')
    },
    [activeRoomId, pushUndo],
  )

  const moveItem = useCallback(
    (id, x, y) => {
      setRooms((prev) =>
        updateActiveRoom(prev, activeRoomId, (room) => ({
          ...room,
          tables: mapSizedItems(room.tables || [], id, { x, y }),
          seats: mapSizedItems(room.seats || [], id, { x, y }),
          items: mapSizedItems(room.items || [], id, { x, y }),
        })),
      )
    },
    [activeRoomId],
  )

  const moveItemsByDelta = useCallback(
    (origins, dx, dy) => {
      const byId = new Map(origins.map((entry) => [entry.id, entry]))
      setRooms((prev) =>
        updateActiveRoom(prev, activeRoomId, (room) => ({
          ...room,
          tables: mapByIdSet(room.tables || [], byId.keys(), (item) => {
            const origin = byId.get(item.id)
            return {
              ...item,
              x: Math.max(0, origin.x + dx),
              y: Math.max(0, origin.y + dy),
            }
          }),
          seats: mapByIdSet(room.seats || [], byId.keys(), (item) => {
            const origin = byId.get(item.id)
            return {
              ...item,
              x: Math.max(0, origin.x + dx),
              y: Math.max(0, origin.y + dy),
            }
          }),
          items: mapByIdSet(room.items || [], byId.keys(), (item) => {
            const origin = byId.get(item.id)
            return {
              ...item,
              x: Math.max(0, origin.x + dx),
              y: Math.max(0, origin.y + dy),
            }
          }),
        })),
      )
    },
    [activeRoomId],
  )

  const resizeItem = useCallback(
    (id, width, height) => {
      setRooms((prev) =>
        updateActiveRoom(prev, activeRoomId, (room) => ({
          ...room,
          tables: mapSizedItems(room.tables || [], id, { width, height }),
          items: mapSizedItems(room.items || [], id, { width, height }),
        })),
      )
    },
    [activeRoomId],
  )

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null

  const updateItem = useCallback(
    (id, patch) => {
      setRooms((prev) =>
        updateActiveRoom(prev, activeRoomId, (room) => ({
          ...room,
          tables: mapSizedItems(room.tables || [], id, patch),
          seats: mapSizedItems(room.seats || [], id, patch),
          items: mapSizedItems(room.items || [], id, patch),
        })),
      )
    },
    [activeRoomId],
  )

  const updateSelected = useCallback(
    (patch) => {
      if (!selectedId) return
      updateItem(selectedId, patch)
    },
    [selectedId, updateItem],
  )

  const deleteSelected = useCallback(() => {
    if (!selectedIds.length) return
    pushUndo()
    const idSet = new Set(selectedIds)
    setRooms((prev) =>
      updateActiveRoom(prev, activeRoomId, (room) => ({
        ...room,
        tables: (room.tables || []).filter((table) => !idSet.has(table.id)),
        seats: (room.seats || []).filter((seat) => !idSet.has(seat.id)),
        items: (room.items || []).filter((item) => !idSet.has(item.id)),
      })),
    )
    setSelectedIds([])
  }, [activeRoomId, pushUndo, selectedIds])

  const duplicateSelected = useCallback(() => {
    if (!selectedIds.length || !activeRoom) return
    pushUndo()
    const { room: nextRoom, newIds } = cloneRoomItems(activeRoom, selectedIds)
    setRooms((prev) =>
      updateActiveRoom(prev, activeRoomId, () => nextRoom),
    )
    setSelectedIds(newIds)
  }, [activeRoom, activeRoomId, pushUndo, selectedIds])

  const fillSeatsFromRoster = useCallback(
    (roster, { shuffle = true } = {}) => {
      pushUndo()
      setRooms((prev) =>
        updateActiveRoom(prev, activeRoomId, (room) => ({
          ...room,
          seats: fillEmptySeats(room.seats || [], roster, { shuffle }),
        })),
      )
    },
    [activeRoomId, pushUndo],
  )

  const clearSeatNames = useCallback(() => {
    pushUndo()
    setRooms((prev) =>
      updateActiveRoom(prev, activeRoomId, (room) => ({
        ...room,
        seats: (room.seats || []).map((seat) => ({ ...seat, studentName: '' })),
      })),
    )
  }, [activeRoomId, pushUndo])

  const selectedItem = useMemo(() => {
    if (!activeRoom || !selectedId) return null
    const table = activeRoom.tables.find((item) => item.id === selectedId)
    if (table) return { type: 'table', ...table }
    const seat = activeRoom.seats.find((item) => item.id === selectedId)
    if (seat) return { type: 'seat', ...seat }
    const item = activeRoom.items.find((entry) => entry.id === selectedId)
    if (item) return { type: 'misc', ...item }
    return null
  }, [activeRoom, selectedId])

  const value = useMemo(
    () => ({
      rooms,
      activeRoom,
      activeRoomId,
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
      persistNow,
      placeTable,
      placeSeat,
      placeMisc,
      moveItem,
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
    }),
    [
      rooms,
      activeRoom,
      activeRoomId,
      tool,
      selectedIds,
      selectedIdSet,
      selectedId,
      selectedItem,
      classOptions,
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
      persistNow,
      placeTable,
      placeSeat,
      placeMisc,
      moveItem,
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
    ],
  )

  return (
    <SeatingContext.Provider value={value}>{children}</SeatingContext.Provider>
  )
}

export function useSeating() {
  const context = useContext(SeatingContext)
  if (!context) {
    throw new Error('useSeating must be used within SeatingProvider')
  }
  return context
}
