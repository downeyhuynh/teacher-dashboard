import { useCallback, useEffect, useRef } from 'react'
import { createId } from '../utils/id'
import { drawStamp } from '../utils/annotationStamps'

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Shortest distance from point p to segment a→b. */
function pointToSegmentDistance(p, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq <= 0.0001) return distance(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return distance(p, { x: a.x + dx * t, y: a.y + dy * t })
}

/**
 * True when the eraser brush touches this mark (stroke, stamp, or text).
 */
function markHitsEraser(mark, point, radius) {
  if (mark.type === 'text') {
    return (
      point.x >= mark.x - radius &&
      point.x <= mark.x + mark.width + radius &&
      point.y >= mark.y - radius &&
      point.y <= mark.y + mark.height + radius
    )
  }

  if (mark.type === 'stamp') {
    const stampRadius = (mark.size || 24) / 2
    return distance(point, { x: mark.x, y: mark.y }) <= radius + stampRadius
  }

  // Ignore leftover destination-out eraser strokes from older sessions.
  if (mark.mode === 'eraser') return true

  const points = mark.points || []
  if (!points.length) return false

  const threshold = radius + (mark.width || 2) / 2
  if (points.length === 1) {
    return distance(point, points[0]) <= threshold
  }

  for (let i = 1; i < points.length; i += 1) {
    if (pointToSegmentDistance(point, points[i - 1], points[i]) <= threshold) {
      return true
    }
  }
  return false
}

/**
 * Pointer drawing on a canvas. Strokes/stamps are stored so they can
 * be redrawn on resize and persisted in context.
 * Hold Shift while drawing to make a straight line from the start point.
 * Eraser removes whole strokes/stamps it touches.
 */
export function useDrawingCanvas({
  strokes,
  onStrokesChange,
  tool,
  enabled = true,
  onPlaceText,
}) {
  const canvasRef = useRef(null)
  const strokesRef = useRef(strokes)
  const drawingRef = useRef(null)
  const erasingRef = useRef(false)

  useEffect(() => {
    strokesRef.current = strokes
  }, [strokes])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const mark of strokesRef.current) {
      // Skip legacy eraser strokes and DOM-rendered text boxes.
      if (mark.mode === 'eraser' || mark.type === 'text') continue

      if (mark.type === 'stamp') {
        drawStamp(ctx, mark)
        continue
      }

      if (!mark.points?.length) continue
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = mark.width
      ctx.strokeStyle = mark.color
      ctx.globalCompositeOperation = 'source-over'

      ctx.beginPath()
      mark.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      if (mark.points.length === 1) {
        const [point] = mark.points
        ctx.lineTo(point.x + 0.01, point.y)
      }
      ctx.stroke()
      ctx.restore()
    }
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const rect = parent.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.floor(parent.offsetWidth || rect.width))
    const height = Math.max(1, Math.floor(parent.offsetHeight || rect.height))

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    redraw()
  }, [redraw])

  useEffect(() => {
    resizeCanvas()
    const parent = canvasRef.current?.parentElement
    if (!parent || typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(() => resizeCanvas())
    observer.observe(parent)
    return () => observer.disconnect()
  }, [resizeCanvas])

  useEffect(() => {
    redraw()
  }, [strokes, redraw])

  const getLocalPoint = useCallback((event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const width = canvas.offsetWidth || rect.width
    const height = canvas.offsetHeight || rect.height
    return {
      x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * width,
      y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * height,
    }
  }, [])

  const eraseAtPoint = useCallback(
    (point) => {
      const radius = Math.max(tool.width * 4, 14)
      const next = strokesRef.current.filter(
        (mark) => !markHitsEraser(mark, point, radius),
      )
      if (next.length !== strokesRef.current.length) {
        strokesRef.current = next
        onStrokesChange(next)
      }
    },
    [onStrokesChange, tool.width],
  )

  const onPointerDown = useCallback(
    (event) => {
      if (!enabled) return
      if (event.button !== 0) return
      // Ctrl/Cmd + drag is reserved for panning the slide.
      if (event.ctrlKey || event.metaKey) return

      const point = getLocalPoint(event)

      if (tool.mode === 'stamp') {
        const stamp = {
          id: createId('stamp'),
          type: 'stamp',
          symbol: tool.stamp || 'check',
          color: tool.color,
          size: Math.max(24, tool.width * 8),
          x: point.x,
          y: point.y,
        }
        const next = [...strokesRef.current, stamp]
        strokesRef.current = next
        onStrokesChange(next)
        return
      }

      if (tool.mode === 'text') {
        onPlaceText?.(point)
        return
      }

      if (tool.mode === 'eraser') {
        erasingRef.current = true
        eraseAtPoint(point)
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }

      const stroke = {
        id: createId('stroke'),
        type: 'stroke',
        mode: tool.mode,
        color: tool.color,
        width: tool.width,
        points: [point],
      }

      drawingRef.current = {
        ...stroke,
        origin: point,
        straight: Boolean(event.shiftKey),
      }
      const next = [...strokesRef.current, stroke]
      strokesRef.current = next
      onStrokesChange(next)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [
      enabled,
      eraseAtPoint,
      getLocalPoint,
      onPlaceText,
      onStrokesChange,
      tool.color,
      tool.mode,
      tool.stamp,
      tool.width,
    ],
  )

  const onPointerMove = useCallback(
    (event) => {
      if (erasingRef.current) {
        eraseAtPoint(getLocalPoint(event))
        return
      }

      if (!drawingRef.current) return
      const point = getLocalPoint(event)
      const current = drawingRef.current
      const useStraight = event.shiftKey || current.straight

      if (useStraight) {
        current.straight = true
        current.points = [current.origin, point]
      } else {
        current.points.push(point)
      }

      const next = strokesRef.current.map((stroke) =>
        stroke.id === current.id
          ? { ...stroke, points: [...current.points] }
          : stroke,
      )
      strokesRef.current = next
      onStrokesChange(next)
    },
    [eraseAtPoint, getLocalPoint, onStrokesChange],
  )

  const endStroke = useCallback(() => {
    drawingRef.current = null
    erasingRef.current = false
  }, [])

  return {
    canvasRef,
    canvasProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endStroke,
      onPointerCancel: endStroke,
      onPointerLeave: endStroke,
    },
  }
}
