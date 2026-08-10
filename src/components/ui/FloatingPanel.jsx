import { useCallback, useMemo } from 'react'
import { useDraggable } from '../../hooks/useDraggable'
import { CloseIcon, MinimizeIcon, RestoreIcon } from './icons'

/**
 * Draggable floating window chrome.
 * Children stay mounted while minimized so tool state can keep running.
 */
export function FloatingPanel({
  id,
  title,
  position,
  size,
  zIndex,
  isMinimized,
  isFocused,
  boundsRef,
  onFocus,
  onMinimize,
  onRestore,
  onClose,
  onPositionChange,
  compact = false,
  hideMinimize = false,
  children,
}) {
  const displaySize = useMemo(() => {
    if (isMinimized) {
      return { width: 200, height: 40 }
    }
    return size
  }, [isMinimized, size])

  const handlePositionChange = useCallback(
    (next) => {
      onPositionChange(id, next)
    },
    [id, onPositionChange],
  )

  const { isDragging, dragHandleProps } = useDraggable({
    enabled: true,
    position,
    onPositionChange: handlePositionChange,
    boundsRef,
    panelSize: displaySize,
  })

  const className = [
    'floating-panel',
    compact ? 'floating-panel--compact' : '',
    isMinimized ? 'is-minimized' : '',
    isFocused ? 'is-focused' : '',
    isDragging ? 'is-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={className}
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? undefined : size.width,
        height: isMinimized ? undefined : size.height,
        zIndex,
      }}
      aria-label={title}
      data-panel-id={id}
      data-minimized={isMinimized ? 'true' : 'false'}
      onMouseDown={() => onFocus(id)}
    >
      <header className="floating-panel__header" {...dragHandleProps}>
        <h2 className="floating-panel__title">{title}</h2>
        <div className="floating-panel__actions">
          {!hideMinimize &&
            (isMinimized ? (
              <button
                type="button"
                className="floating-panel__action"
                aria-label={`Restore ${title}`}
                onClick={() => onRestore(id)}
              >
                <RestoreIcon />
              </button>
            ) : (
              <button
                type="button"
                className="floating-panel__action"
                aria-label={`Minimize ${title}`}
                onClick={() => onMinimize(id)}
              >
                <MinimizeIcon />
              </button>
            ))}
          <button
            type="button"
            className="floating-panel__action is-danger"
            aria-label={`Close ${title}`}
            onClick={() => onClose(id)}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      {/* Keep body mounted while minimized so future tool logic keeps running. */}
      <div className="floating-panel__body" aria-hidden={isMinimized}>
        {children}
      </div>
    </section>
  )
}
