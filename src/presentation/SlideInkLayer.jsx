import { useDrawingCanvas } from '../hooks/useDrawingCanvas'

/**
 * Transparent ink surface aligned to the current slide image.
 */
export function SlideInkLayer({
  enabled = false,
  strokes = [],
  onStrokesChange,
  onPlaceText,
  tool,
  className = '',
  label = 'Slide drawing',
}) {
  const { canvasRef, canvasProps } = useDrawingCanvas({
    strokes,
    onStrokesChange,
    onPlaceText,
    tool,
    enabled,
  })

  return (
    <canvas
      ref={canvasRef}
      className={`slide-ink-layer annotation-layer ${enabled ? 'is-active' : ''} ${className}`.trim()}
      aria-label={label}
      {...canvasProps}
    />
  )
}
