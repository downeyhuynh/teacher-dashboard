import { useCallback, useEffect, useRef } from 'react'
import { createId } from '../utils/id'
import { drawStamp } from '../utils/annotationStamps'

/**
 * Pointer drawing on a canvas. Strokes/stamps are stored so they can
 * be redrawn on resize and persisted in context.
 */
export function useDrawingCanvas({
  strokes,
  onStrokesChange,
  tool,
  enabled = true,
}) {
  const canvasRef = useRef(null)
  const strokesRef = useRef(strokes)
  const drawingRef = useRef(null)

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
      ctx.globalCompositeOperation =
        mark.mode === 'eraser' ? 'destination-out' : 'source-over'

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
    // Use untransformed layout size from offsetWidth when available so
    // zoom transforms on ancestors don't skew canvas coordinate space.
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

  const onPointerDown = useCallback(
    (event) => {
      if (!enabled) return
      if (event.button !== 0) return

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
        onStrokesChange([...strokesRef.current, stamp])
        return
      }

      const stroke = {
        id: createId('stroke'),
        type: 'stroke',
        mode: tool.mode,
        color: tool.color,
        width: tool.mode === 'eraser' ? Math.max(tool.width * 4, 12) : tool.width,
        points: [point],
      }

      drawingRef.current = stroke
      onStrokesChange([...strokesRef.current, stroke])
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [
      enabled,
      getLocalPoint,
      onStrokesChange,
      tool.color,
      tool.mode,
      tool.stamp,
      tool.width,
    ],
  )

  const onPointerMove = useCallback(
    (event) => {
      if (!drawingRef.current) return
      const point = getLocalPoint(event)
      const current = drawingRef.current
      current.points.push(point)

      const next = strokesRef.current.map((stroke) =>
        stroke.id === current.id
          ? { ...stroke, points: [...current.points] }
          : stroke,
      )
      onStrokesChange(next)
    },
    [getLocalPoint, onStrokesChange],
  )

  const endStroke = useCallback(() => {
    drawingRef.current = null
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
