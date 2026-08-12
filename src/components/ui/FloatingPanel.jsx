import { useCallback, useMemo } from 'react'
import { useDraggable } from '../../hooks/useDraggable'
import { useResizable } from '../../hooks/useResizable'
import { CloseIcon, MinimizeIcon, RestoreIcon } from './icons'

const RESIZE_EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

/**
 * Draggable + resizable floating window chrome.
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
  onSizeChange,
  compact = false,
  hideMinimize = false,
  resizable = true,
  children,
}) {
  const displaySize = useMemo(() => {
    if (isMinimized) {
      return { width: 200, height: 40 }
    }
    return size
  }, [isMinimized, size])

  const minWidth = compact ? 140 : 280
  const minHeight = compact ? 100 : 180

  const handlePositionChange = useCallback(
    (next) => {
      onPositionChange(id, next)
    },
    [id, onPositionChange],
  )

  const handleSizeChange = useCallback(
    (next) => {
      onSizeChange?.(id, next)
    },
    [id, onSizeChange],
  )

  const { isDragging, dragHandleProps } = useDraggable({
    enabled: true,
    position,
    onPositionChange: handlePositionChange,
    boundsRef,
    panelSize: displaySize,
  })

  const { isResizing, getResizeHandleProps } = useResizable({
    enabled: Boolean(resizable && onSizeChange && !isMinimized),
    position,
    size,
    onPositionChange: handlePositionChange,
    onSizeChange: handleSizeChange,
    boundsRef,
    minWidth,
    minHeight,
  })

  const className = [
    'floating-panel',
    compact ? 'floating-panel--compact' : '',
    isMinimized ? 'is-minimized' : '',
    isFocused ? 'is-focused' : '',
    isDragging ? 'is-dragging' : '',
    isResizing ? 'is-resizing' : '',
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

      {resizable && onSizeChange && !isMinimized &&
        RESIZE_EDGES.map((edge) => (
          <div
            key={edge}
            className={`floating-panel__resize floating-panel__resize--${edge}`}
            aria-hidden="true"
            {...getResizeHandleProps(edge)}
          />
        ))}
    </section>
  )
}
