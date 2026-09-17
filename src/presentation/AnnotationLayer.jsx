import { useCallback } from 'react'
import { usePresentation } from '../context/PresentationContext'
import { AnnotationTextBox } from './AnnotationTextBox'
import { SlideInkLayer } from './SlideInkLayer'

/**
 * Annotation marks drawn onto the current slide (ink + text boxes).
 */
export function AnnotationLayer({ enabled }) {
  const {
    currentSlide,
    annotationsBySlide,
    setSlideAnnotations,
    annotationTool,
    updateTextAnnotation,
    addTextAnnotation,
    focusTextId,
    setFocusTextId,
    slideView,
  } = usePresentation()

  const slideId = currentSlide?.id
  const strokes = (slideId && annotationsBySlide[slideId]) || []
  const textMarks = strokes.filter((mark) => mark.type === 'text')
  // Only editable while annotate drawing is active (not hand/pan) and text tool
  // is selected, or the box was just opened and still focused.
  const canEditText = Boolean(enabled)
  const textInteractive = Boolean(canEditText && annotationTool.mode === 'text')

  const handleStrokesChange = useCallback(
    (next) => {
      if (!slideId) return
      setSlideAnnotations(slideId, next)
    },
    [setSlideAnnotations, slideId],
  )

  const handleCanvasPlaceText = useCallback(
    (point) => {
      if (!slideId) return
      addTextAnnotation(slideId, {
        x: point.x - 120,
        y: point.y - 50,
      })
    },
    [addTextAnnotation, slideId],
  )

  return (
    <div className={`annotation-stack ${enabled ? 'is-active' : ''}`.trim()}>
      <SlideInkLayer
        enabled={Boolean(enabled && slideId)}
        strokes={strokes}
        onStrokesChange={handleStrokesChange}
        onPlaceText={handleCanvasPlaceText}
        tool={annotationTool}
        label="Slide annotations"
      />
      <div className="annotation-text-layer" aria-hidden={!textMarks.length}>
        {textMarks.map((mark) => (
          <AnnotationTextBox
            key={mark.id}
            mark={mark}
            selected={focusTextId === mark.id}
            interactive={
              canEditText && (textInteractive || focusTextId === mark.id)
            }
            scale={slideView.scale}
            onSelect={() => setFocusTextId(mark.id)}
            onChange={(patch) => updateTextAnnotation(slideId, mark.id, patch)}
          />
        ))}
      </div>
    </div>
  )
}
