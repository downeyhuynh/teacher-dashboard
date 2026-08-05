import { useCallback } from 'react'
import { usePresentation } from '../context/PresentationContext'
import { SlideInkLayer } from './SlideInkLayer'

/**
 * Annotation marks drawn onto the current slide.
 */
export function AnnotationLayer({ enabled }) {
  const {
    currentSlide,
    annotationsBySlide,
    setSlideAnnotations,
    annotationTool,
  } = usePresentation()

  const slideId = currentSlide?.id
  const strokes = (slideId && annotationsBySlide[slideId]) || []

  const handleStrokesChange = useCallback(
    (next) => {
      if (!slideId) return
      setSlideAnnotations(slideId, next)
    },
    [setSlideAnnotations, slideId],
  )

  return (
    <SlideInkLayer
      enabled={Boolean(enabled && slideId)}
      strokes={strokes}
      onStrokesChange={handleStrokesChange}
      tool={annotationTool}
      label="Slide annotations"
    />
  )
}
