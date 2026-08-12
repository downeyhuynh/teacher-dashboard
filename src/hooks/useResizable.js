import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp } from '../utils/clamp'

/**
 * Pointer resize for floating panels (edges + corners).
 * Keeps the panel within bounds and above min size.
 */
export function useResizable({
  enabled = true,
  position,
  size,
  onPositionChange,
  onSizeChange,
  boundsRef,
  minWidth = 280,
  minHeight = 180,
}) {
  const resizingRef = useRef(false)
  const originRef = useRef(null)
  const [isResizing, setIsResizing] = useState(false)
  const [activeEdge, setActiveEdge] = useState(null)

  const onResizePointerDown = useCallback(
    (edge) => (event) => {
      if (!enabled) return
      if (event.button !== 0) return

      event.preventDefault()
      event.stopPropagation()

      resizingRef.current = true
      setIsResizing(true)
      setActiveEdge(edge)
      originRef.current = {
        edge,
        pointerX: event.clientX,
        pointerY: event.clientY,
        startX: position.x,
        startY: position.y,
        startW: size.width,
        startH: size.height,
      }

      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    [enabled, position.x, position.y, size.height, size.width],
  )

  useEffect(() => {
    if (!isResizing) return undefined

    const handlePointerMove = (event) => {
      if (!resizingRef.current || !originRef.current) return

      const {
        edge,
        pointerX,
        pointerY,
        startX,
        startY,
        startW,
        startH,
      } = originRef.current

      const deltaX = event.clientX - pointerX
      const deltaY = event.clientY - pointerY

      let nextX = startX
      let nextY = startY
      let nextW = startW
      let nextH = startH

      const boundsEl = boundsRef?.current
      const bounds = boundsEl?.getBoundingClientRect()
      const maxRight = bounds ? bounds.width : Number.POSITIVE_INFINITY
      const maxBottom = bounds ? bounds.height : Number.POSITIVE_INFINITY

      if (edge.includes('e')) {
        nextW = startW + deltaX
      }
      if (edge.includes('s')) {
        nextH = startH + deltaY
      }
      if (edge.includes('w')) {
        nextW = startW - deltaX
        nextX = startX + deltaX
      }
      if (edge.includes('n')) {
        nextH = startH - deltaY
        nextY = startY + deltaY
      }

      // Enforce minimum size, adjusting position for west/north edges.
      if (nextW < minWidth) {
        if (edge.includes('w')) {
          nextX -= minWidth - nextW
        }
        nextW = minWidth
      }
      if (nextH < minHeight) {
        if (edge.includes('n')) {
          nextY -= minHeight - nextH
        }
        nextH = minHeight
      }

      // Keep inside bounds.
      nextX = clamp(nextX, 0, Math.max(0, maxRight - minWidth))
      nextY = clamp(nextY, 0, Math.max(0, maxBottom - minHeight))
      nextW = clamp(nextW, minWidth, Math.max(minWidth, maxRight - nextX))
      nextH = clamp(nextH, minHeight, Math.max(minHeight, maxBottom - nextY))

      onPositionChange({ x: Math.round(nextX), y: Math.round(nextY) })
      onSizeChange({ width: Math.round(nextW), height: Math.round(nextH) })
    }

    const endResize = () => {
      resizingRef.current = false
      setIsResizing(false)
      setActiveEdge(null)
      originRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', endResize)
    window.addEventListener('pointercancel', endResize)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', endResize)
      window.removeEventListener('pointercancel', endResize)
    }
  }, [
    boundsRef,
    isResizing,
    minHeight,
    minWidth,
    onPositionChange,
    onSizeChange,
  ])

  return {
    isResizing,
    activeEdge,
    getResizeHandleProps: (edge) => ({
      onPointerDown: onResizePointerDown(edge),
    }),
  }
}
