import { useCallback, useEffect, useRef, useState } from 'react'
import { usePresentation } from '../../context/PresentationContext'
import { AnnotationLayer } from '../../presentation/AnnotationLayer'
import { ImportDropzone } from '../../presentation/ImportDropzone'
import { SlideNav } from '../../presentation/SlideNav'
import { SlideViewControls } from '../../presentation/SlideViewControls'

/**
 * Main presentation viewport: slides, import, on-slide ink overlays.
 */
export function PresentationStage({
  annotateActive = false,
  onRequestAnnotate,
  isFullscreen = false,
  onToggleFullscreen,
}) {
  const {
    currentSlide,
    slideCount,
    nextSlide,
    prevSlide,
    isImporting,
    slideView,
    panSlideView,
    zoomAt,
    zoomIn,
    zoomOut,
    resetSlideView,
    undoSlideAnnotation,
    canUndoAnnotation,
    updateAnnotationTool,
    enableAnnotate,
    addTextAnnotation,
    setFocusTextId,
  } = usePresentation()

  const [panMode, setPanMode] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const dragRef = useRef(null)

  const isPanning = panMode || spaceHeld || ctrlHeld
  const drawEnabled = annotateActive && !isPanning
  const frameRef = useRef(null)

  const toggleFullscreen = useCallback(() => {
    onToggleFullscreen?.()
  }, [onToggleFullscreen])

  useEffect(() => {
    // Block browser page-zoom (Ctrl/Cmd + wheel) so only the slide scales.
    const preventBrowserZoom = (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
      }
    }
    window.addEventListener('wheel', preventBrowserZoom, { passive: false })
    return () => {
      window.removeEventListener('wheel', preventBrowserZoom)
    }
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || slideCount === 0) return undefined

    const onWheel = (event) => {
      event.preventDefault()

      const rect = frame.getBoundingClientRect()
      const origin = {
        x: event.clientX - (rect.left + rect.width / 2),
        y: event.clientY - (rect.top + rect.height / 2),
      }

      if (event.deltaY < 0) zoomAt(1.2, origin)
      else zoomAt(1 / 1.2, origin)
    }

    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [slideCount, zoomAt])

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) {
        return
      }

      if (event.key === 'Control' || event.key === 'Meta') {
        setCtrlHeld(true)
      }

      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        setSpaceHeld(true)
        return
      }

      const key = event.key.toLowerCase()
      const withMod = event.ctrlKey || event.metaKey

      if (withMod && (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '_' || key === '0')) {
        event.preventDefault()
        if (key === '0') resetSlideView()
        else if (event.key === '+' || event.key === '=') zoomIn()
        else zoomOut()
        return
      }

      if (key === 'h' && !withMod && !event.altKey) {
        event.preventDefault()
        setPanMode((prev) => {
          const next = !prev
          if (next) setFocusTextId(null)
          return next
        })
        return
      }

      if (key === 'p' && !withMod && !event.altKey) {
        event.preventDefault()
        setPanMode(false)
        onRequestAnnotate?.()
        updateAnnotationTool({ mode: 'pen' })
        setFocusTextId(null)
        return
      }

      if (key === 'e' && !withMod && !event.altKey) {
        event.preventDefault()
        setPanMode(false)
        enableAnnotate()
        onRequestAnnotate?.()
        updateAnnotationTool({ mode: 'eraser' })
        setFocusTextId(null)
        return
      }

      if (key === 't' && !withMod && !event.altKey) {
        event.preventDefault()
        setPanMode(false)
        onRequestAnnotate?.()
        if (currentSlide) {
          addTextAnnotation(currentSlide.id)
        } else {
          enableAnnotate()
          updateAnnotationTool({ mode: 'text' })
        }
        return
      }

      if (key === 'f' && !withMod && !event.altKey) {
        event.preventDefault()
        toggleFullscreen()
        return
      }

      if (withMod && key === 'z') {
        if (canUndoAnnotation && currentSlide) {
          event.preventDefault()
          undoSlideAnnotation(currentSlide.id)
        }
        return
      }

      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        nextSlide()
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        prevSlide()
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoomIn()
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        zoomOut()
      }
    }

    const onKeyUp = (event) => {
      if (event.code === 'Space') {
        setSpaceHeld(false)
      }
      if (event.key === 'Control' || event.key === 'Meta') {
        setCtrlHeld(false)
        if (!panMode && !spaceHeld) {
          dragRef.current = null
        }
      }
    }

    const onBlur = () => {
      setCtrlHeld(false)
      setSpaceHeld(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [
    addTextAnnotation,
    canUndoAnnotation,
    currentSlide,
    enableAnnotate,
    nextSlide,
    onRequestAnnotate,
    panMode,
    prevSlide,
    setFocusTextId,
    spaceHeld,
    toggleFullscreen,
    undoSlideAnnotation,
    updateAnnotationTool,
    zoomIn,
    zoomOut,
    resetSlideView,
  ])

  const onFramePointerDown = (event) => {
    if (event.button !== 0) return
    const modifierPan = event.ctrlKey || event.metaKey
    if (!isPanning && !modifierPan) return

    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onFramePointerMove = (event) => {
    if (!dragRef.current) return
    event.preventDefault()
    const dx = event.clientX - dragRef.current.x
    const dy = event.clientY - dragRef.current.y
    dragRef.current = { x: event.clientX, y: event.clientY }
    panSlideView(dx, dy)
  }

  const endPan = () => {
    dragRef.current = null
  }

  return (
    <main
      className={`presentation-stage ${isFullscreen ? 'is-fullscreen' : ''}`}
      aria-label="Presentation stage"
    >
      <div className="presentation-stage__surface">
        <SlideNav
          viewControls={
            slideCount > 0 ? (
              <SlideViewControls
                panMode={panMode}
                onPanModeChange={(next) => {
                  setPanMode(next)
                  if (next) setFocusTextId(null)
                }}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
              />
            ) : null
          }
        />

        {slideCount === 0 ? (
          <div className="presentation-stage__empty">
            <ImportDropzone />
          </div>
        ) : (
          <div className="slide-viewport">
            <div
              ref={frameRef}
              className={`slide-viewport__frame ${isPanning ? 'is-panning' : ''}`}
              onPointerDownCapture={onFramePointerDown}
              onPointerMove={onFramePointerMove}
              onPointerUp={endPan}
              onPointerCancel={endPan}
            >
              <div
                className="slide-viewport__slide"
                style={{
                  transform: `translate(${slideView.x}px, ${slideView.y}px) scale(${slideView.scale})`,
                }}
              >
                {currentSlide?.src ? (
                  <img
                    className={`slide-viewport__image ${
                      currentSlide.source === 'whiteboard'
                        ? 'slide-viewport__image--whiteboard'
                        : ''
                    }`}
                    src={currentSlide.src}
                    alt={currentSlide.name}
                    draggable={false}
                  />
                ) : null}
                <AnnotationLayer enabled={annotateActive && drawEnabled} />
              </div>
            </div>

            {!isFullscreen && (
              <div className="slide-viewport__rail">
                <ImportDropzone compact />
              </div>
            )}
          </div>
        )}

        {isImporting && slideCount > 0 && (
          <div className="presentation-stage__busy" aria-live="polite">
            Importing slides…
          </div>
        )}
      </div>
    </main>
  )
}
