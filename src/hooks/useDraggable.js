import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp } from '../utils/clamp'

/**
 * Pointer-based drag for floating panels.
 * Keeps the panel within the provided bounds element.
 */
export function useDraggable({
  enabled = true,
  position,
  onPositionChange,
  boundsRef,
  panelSize,
}) {
  const draggingRef = useRef(false)
  const originRef = useRef({ pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const onPointerDown = useCallback(
    (event) => {
      if (!enabled) return
      if (event.button !== 0) return

      // Ignore interactive controls inside the drag handle.
      if (event.target.closest('button, a, input, textarea, select')) return

      draggingRef.current = true
      setIsDragging(true)
      originRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        startX: position.x,
        startY: position.y,
      }

      event.currentTarget.setPointerCapture?.(event.pointerId)
      event.preventDefault()
    },
    [enabled, position.x, position.y],
  )

  useEffect(() => {
    if (!isDragging) return undefined

    const handlePointerMove = (event) => {
      if (!draggingRef.current) return

      const deltaX = event.clientX - originRef.current.pointerX
      const deltaY = event.clientY - originRef.current.pointerY

      let nextX = originRef.current.startX + deltaX
      let nextY = originRef.current.startY + deltaY

      const boundsEl = boundsRef?.current
      if (boundsEl) {
        const rect = boundsEl.getBoundingClientRect()
        const maxX = Math.max(0, rect.width - panelSize.width)
        const maxY = Math.max(0, rect.height - panelSize.height)
        nextX = clamp(nextX, 0, maxX)
        nextY = clamp(nextY, 0, maxY)
      }

      onPositionChange({ x: nextX, y: nextY })
    }

    const endDrag = () => {
      draggingRef.current = false
      setIsDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
    }
  }, [boundsRef, isDragging, onPositionChange, panelSize.height, panelSize.width])

  return {
    isDragging,
    dragHandleProps: {
      onPointerDown,
    },
  }
}
