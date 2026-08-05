import { useEffect, useRef, useState } from 'react'
import { usePresentation } from '../../context/PresentationContext'
import { AnnotationLayer } from '../../presentation/AnnotationLayer'
import { ImportDropzone } from '../../presentation/ImportDropzone'
import { SlideNav } from '../../presentation/SlideNav'
import { SlideViewControls } from '../../presentation/SlideViewControls'

/**
 * Main presentation viewport: slides, import, on-slide ink overlays.
 */
export function PresentationStage({ annotateActive = false }) {
  const {
    currentSlide,
    slideCount,
    nextSlide,
    prevSlide,
    isImporting,
    slideView,
    panSlideView,
    zoomIn,
    zoomOut,
    undoSlideAnnotation,
    canUndoAnnotation,
  } = usePresentation()

  const [panMode, setPanMode] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const dragRef = useRef(null)

  const isPanning = panMode || spaceHeld
  const drawEnabled = annotateActive && !isPanning

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) {
        return
      }

      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        setSpaceHeld(true)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
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
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [
    canUndoAnnotation,
    currentSlide,
    nextSlide,
    prevSlide,
    undoSlideAnnotation,
    zoomIn,
    zoomOut,
  ])

  const onFrameWheel = (event) => {
    if (slideCount === 0) return
    event.preventDefault()
    if (event.deltaY < 0) zoomIn()
    else zoomOut()
  }

  const onFramePointerDown = (event) => {
    if (!isPanning || event.button !== 0) return
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onFramePointerMove = (event) => {
    if (!dragRef.current) return
    const dx = event.clientX - dragRef.current.x
    const dy = event.clientY - dragRef.current.y
    dragRef.current = { x: event.clientX, y: event.clientY }
    panSlideView(dx, dy)
  }

  const endPan = () => {
    dragRef.current = null
  }

  return (
    <main className="presentation-stage" aria-label="Presentation stage">
      <div className="presentation-stage__surface">
        <SlideNav
          viewControls={
            slideCount > 0 ? (
              <SlideViewControls panMode={panMode} onPanModeChange={setPanMode} />
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
              className={`slide-viewport__frame ${isPanning ? 'is-panning' : ''}`}
              onWheel={onFrameWheel}
              onPointerDown={onFramePointerDown}
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
                <img
                  className="slide-viewport__image"
                  src={currentSlide.src}
                  alt={currentSlide.name}
                  draggable={false}
                />
                <AnnotationLayer enabled={annotateActive && drawEnabled} />
              </div>
            </div>

            <div className="slide-viewport__rail">
              <ImportDropzone compact />
            </div>
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
