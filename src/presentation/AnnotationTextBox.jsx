import { useEffect, useRef } from 'react'

const MIN_W = 80
const MIN_H = 40
const MIN_FONT = 10
const MAX_FONT = 96

/**
 * Editable, corner-resizable text annotation on the slide.
 */
export function AnnotationTextBox({
  mark,
  selected,
  interactive,
  scale = 1,
  onSelect,
  onChange,
}) {
  const areaRef = useRef(null)
  const dragRef = useRef(null)
  const fontSize = mark.fontSize || 20

  useEffect(() => {
    if (selected && interactive && areaRef.current) {
      areaRef.current.focus()
    }
  }, [selected, interactive])

  const startResize = (corner, event) => {
    if (!interactive) return
    event.preventDefault()
    event.stopPropagation()
    onSelect?.()

    const startX = event.clientX
    const startY = event.clientY
    const origin = {
      x: mark.x,
      y: mark.y,
      width: mark.width,
      height: mark.height,
    }
    const viewScale = Math.max(scale, 0.01)

    const onMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / viewScale
      const dy = (moveEvent.clientY - startY) / viewScale
      let { x, y, width, height } = origin

      if (corner.includes('e')) width = Math.max(MIN_W, origin.width + dx)
      if (corner.includes('s')) height = Math.max(MIN_H, origin.height + dy)
      if (corner.includes('w')) {
        width = Math.max(MIN_W, origin.width - dx)
        x = origin.x + (origin.width - width)
      }
      if (corner.includes('n')) {
        height = Math.max(MIN_H, origin.height - dy)
        y = origin.y + (origin.height - height)
      }

      onChange({ x, y, width, height })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startMove = (event) => {
    if (!interactive) return
    if (event.button !== 0) return
    if (event.target.closest('textarea, button, input, .annotation-text-box__font')) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    onSelect?.()

    const viewScale = Math.max(scale, 0.01)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: mark.x,
      originY: mark.y,
    }

    const onMove = (moveEvent) => {
      if (!dragRef.current) return
      const dx = (moveEvent.clientX - dragRef.current.startX) / viewScale
      const dy = (moveEvent.clientY - dragRef.current.startY) / viewScale
      onChange({
        x: dragRef.current.originX + dx,
        y: dragRef.current.originY + dy,
      })
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const setFontSize = (next) => {
    const value = Math.min(MAX_FONT, Math.max(MIN_FONT, Number(next) || MIN_FONT))
    onChange({ fontSize: value })
  }

  const onKeyDown = (event) => {
    if (!interactive) return
    const withMod = event.ctrlKey || event.metaKey
    if (!withMod) return

    const key = event.key.toLowerCase()
    if (key === 'b') {
      event.preventDefault()
      onChange({ bold: !mark.bold })
      return
    }
    if (key === 'i') {
      event.preventDefault()
      onChange({ italic: !mark.italic })
      return
    }
    if (key === 'u') {
      event.preventDefault()
      onChange({ underline: !mark.underline })
    }
  }

  return (
    <div
      className={`annotation-text-box ${selected ? 'is-selected' : ''} ${
        interactive ? 'is-interactive' : ''
      }`}
      style={{
        left: mark.x,
        top: mark.y,
        width: mark.width,
        height: mark.height,
        color: mark.color,
        fontSize,
        fontWeight: mark.bold ? 700 : 600,
        fontStyle: mark.italic ? 'italic' : 'normal',
        textDecoration: mark.underline ? 'underline' : 'none',
        pointerEvents: interactive ? 'auto' : 'none',
      }}
      onPointerDown={startMove}
    >
      {selected && interactive ? (
        <div
          className="annotation-text-box__font"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="annotation-text-box__font-label">Font size</span>
          <button
            type="button"
            className="annotation-text-box__font-step"
            aria-label="Decrease font size"
            onClick={() => setFontSize(fontSize - 2)}
          >
            −
          </button>
          <input
            type="number"
            className="annotation-text-box__font-input"
            min={MIN_FONT}
            max={MAX_FONT}
            value={fontSize}
            aria-label="Font size"
            onChange={(event) => setFontSize(event.target.value)}
          />
          <button
            type="button"
            className="annotation-text-box__font-step"
            aria-label="Increase font size"
            onClick={() => setFontSize(fontSize + 2)}
          >
            +
          </button>
        </div>
      ) : null}

      <textarea
        ref={areaRef}
        className="annotation-text-box__input"
        value={mark.text || ''}
        placeholder="Type here…"
        readOnly={!interactive}
        onChange={(event) => onChange({ text: event.target.value })}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if (!interactive) return
          event.stopPropagation()
          onSelect?.()
        }}
      />
      {selected && interactive
        ? ['nw', 'ne', 'sw', 'se'].map((corner) => (
            <button
              key={corner}
              type="button"
              aria-label={`Resize ${corner}`}
              className={`annotation-text-box__handle annotation-text-box__handle--${corner}`}
              onPointerDown={(event) => startResize(corner, event)}
            />
          ))
        : null}
    </div>
  )
}
