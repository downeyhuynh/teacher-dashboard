import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import {
  createWhiteboardSlide,
  importPresentationFiles,
  revokeSlideUrls,
} from '../utils/presentationImport'
import { ANNOTATION_STAMPS } from '../utils/annotationStamps'
import { clamp } from '../utils/clamp'
import { createId } from '../utils/id'

const MAX_UNDO = 60

/** True when marks were added/removed (not just stroke points updated). */
function isStructuralAnnotationChange(prevMarks, nextMarks) {
  if (prevMarks.length !== nextMarks.length) return true
  for (let i = 0; i < prevMarks.length; i += 1) {
    if (prevMarks[i].id !== nextMarks[i].id) return true
  }
  return false
}

const ANNOTATION_COLORS = [
  '#1a2332',
  '#c0392b',
  '#0d7a6f',
  '#1f6feb',
  '#d97706',
  '#ffffff',
]

const defaultInkTool = {
  mode: 'pen', // pen | eraser | stamp | text
  color: ANNOTATION_COLORS[0],
  width: 3,
  stamp: 'check',
}

const DEFAULT_VIEW = { scale: 1, x: 0, y: 0 }

const PresentationContext = createContext(null)

export function PresentationProvider({ children }) {
  const [slides, setSlides] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const annotationsRef = useRef({})
  const annotationUndoRef = useRef({})
  const [annotationsBySlide, setAnnotationsBySlide] = useState({})
  const [annotationUndoBySlide, setAnnotationUndoBySlide] = useState({})
  const [annotationTool, setAnnotationTool] = useState(defaultInkTool)
  const [annotateEnabled, setAnnotateEnabled] = useState(false)
  const [focusTextId, setFocusTextId] = useState(null)
  const [slideView, setSlideView] = useState(DEFAULT_VIEW)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const [importErrors, setImportErrors] = useState([])
  const [deckName, setDeckName] = useState('')

  const currentSlide = slides[currentIndex] ?? null

  const importFiles = useCallback(async (fileList, { append = true } = {}) => {
    if (!fileList?.length) return

    setIsImporting(true)
    setImportErrors([])
    setImportProgress({ fileName: '', pageNumber: 0, total: 0 })

    try {
      const { slides: nextSlides, errors } = await importPresentationFiles(fileList, {
        onProgress: setImportProgress,
      })

      if (errors.length) {
        setImportErrors(errors)
      }

      if (!nextSlides.length) return

      setSlides((prev) => {
        if (!append && prev.length) {
          revokeSlideUrls(prev)
        }
        const merged = append ? [...prev, ...nextSlides] : nextSlides
        return merged
      })

      if (!append) {
        annotationsRef.current = {}
        annotationUndoRef.current = {}
        setAnnotationsBySlide({})
        setAnnotationUndoBySlide({})
        setFocusTextId(null)
        setCurrentIndex(0)
        setSlideView(DEFAULT_VIEW)
      }

      const firstName = fileList[0]?.name?.replace(/\.[^.]+$/, '') || 'Lesson'
      setDeckName((prev) => prev || firstName)
    } finally {
      setIsImporting(false)
      setImportProgress(null)
    }
  }, [])

  const clearDeck = useCallback(() => {
    setSlides((prev) => {
      revokeSlideUrls(prev)
      return []
    })
    annotationsRef.current = {}
    annotationUndoRef.current = {}
    setAnnotationsBySlide({})
    setAnnotationUndoBySlide({})
    setFocusTextId(null)
    setCurrentIndex(0)
    setDeckName('')
    setImportErrors([])
    setSlideView(DEFAULT_VIEW)
  }, [])

  /** Insert a blank whiteboard after the current slide and jump to it. */
  const addWhiteboardSlide = useCallback(() => {
    const board = createWhiteboardSlide()
    setSlides((prev) => {
      if (!prev.length) return [board]
      const insertAt = currentIndex + 1
      return [...prev.slice(0, insertAt), board, ...prev.slice(insertAt)]
    })
    setCurrentIndex((prev) => (slides.length === 0 ? 0 : prev + 1))
    setSlideView(DEFAULT_VIEW)
    setDeckName((prev) => prev || 'Lesson')
  }, [currentIndex, slides.length])

  const goToSlide = useCallback(
    (index) => {
      setCurrentIndex(() => {
        if (!slides.length) return 0
        return Math.min(Math.max(0, index), slides.length - 1)
      })
    },
    [slides.length],
  )

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, Math.max(0, slides.length - 1)))
  }, [slides.length])

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const pushAnnotationUndo = useCallback((slideId, marks) => {
    const stack = annotationUndoRef.current[slideId] || []
    const next = {
      ...annotationUndoRef.current,
      [slideId]: [...stack, marks].slice(-MAX_UNDO),
    }
    annotationUndoRef.current = next
    setAnnotationUndoBySlide(next)
  }, [])

  const replaceAnnotations = useCallback((next) => {
    annotationsRef.current = next
    setAnnotationsBySlide(next)
  }, [])

  const setSlideAnnotations = useCallback(
    (slideId, strokes) => {
      const current = annotationsRef.current[slideId] || []
      if (isStructuralAnnotationChange(current, strokes)) {
        pushAnnotationUndo(slideId, current)
      }
      replaceAnnotations({
        ...annotationsRef.current,
        [slideId]: strokes,
      })
    },
    [pushAnnotationUndo, replaceAnnotations],
  )

  const clearSlideAnnotations = useCallback(
    (slideId) => {
      const current = annotationsRef.current[slideId] || []
      if (current.length) {
        pushAnnotationUndo(slideId, current)
      }
      replaceAnnotations({
        ...annotationsRef.current,
        [slideId]: [],
      })
      setFocusTextId(null)
    },
    [pushAnnotationUndo, replaceAnnotations],
  )

  const undoSlideAnnotation = useCallback(
    (slideId) => {
      if (!slideId) return
      const stack = annotationUndoRef.current[slideId] || []
      if (!stack.length) return

      const previous = stack[stack.length - 1]
      const nextUndo = {
        ...annotationUndoRef.current,
        [slideId]: stack.slice(0, -1),
      }
      annotationUndoRef.current = nextUndo
      setAnnotationUndoBySlide(nextUndo)
      replaceAnnotations({
        ...annotationsRef.current,
        [slideId]: previous,
      })
      setFocusTextId(null)
    },
    [replaceAnnotations],
  )

  const addTextAnnotation = useCallback(
    (slideId, point = null) => {
      if (!slideId) return null
      const box = {
        id: createId('text'),
        type: 'text',
        text: '',
        x: point?.x ?? 72,
        y: point?.y ?? 72,
        width: 240,
        height: 100,
        color: annotationTool.color,
        fontSize: Math.max(18, annotationTool.width * 6),
        bold: false,
        italic: false,
        underline: false,
      }

      const current = annotationsRef.current[slideId] || []
      pushAnnotationUndo(slideId, current)
      replaceAnnotations({
        ...annotationsRef.current,
        [slideId]: [...current, box],
      })
      setFocusTextId(box.id)
      setAnnotationTool((prev) => ({ ...prev, mode: 'text' }))
      setAnnotateEnabled(true)
      return box.id
    },
    [annotationTool.color, annotationTool.width, pushAnnotationUndo, replaceAnnotations],
  )

  const updateTextAnnotation = useCallback(
    (slideId, textId, patch) => {
      if (!slideId || !textId) return
      const current = annotationsRef.current[slideId] || []
      replaceAnnotations({
        ...annotationsRef.current,
        [slideId]: current.map((mark) =>
          mark.id === textId ? { ...mark, ...patch } : mark,
        ),
      })
    },
    [replaceAnnotations],
  )

  const clearAllAnnotations = useCallback(() => {
    annotationsRef.current = {}
    annotationUndoRef.current = {}
    setAnnotationsBySlide({})
    setAnnotationUndoBySlide({})
    setFocusTextId(null)
  }, [])

  const updateAnnotationTool = useCallback((patch) => {
    setAnnotationTool((prev) => ({ ...prev, ...patch }))
  }, [])

  const toggleAnnotateEnabled = useCallback(() => {
    setAnnotateEnabled((prev) => !prev)
  }, [])

  const enableAnnotate = useCallback(() => {
    setAnnotateEnabled(true)
  }, [])

  const disableAnnotate = useCallback(() => {
    setAnnotateEnabled(false)
  }, [])

  const clearAllMarks = useCallback(() => {
    annotationsRef.current = {}
    annotationUndoRef.current = {}
    setAnnotationsBySlide({})
    setAnnotationUndoBySlide({})
    setFocusTextId(null)
  }, [])

  const zoomAt = useCallback((factor, origin = null) => {
    setSlideView((prev) => {
      const nextScale = clamp(Number((prev.scale * factor).toFixed(3)), 0.4, 4)
      if (!origin || nextScale === prev.scale) {
        return { ...prev, scale: nextScale }
      }

      // Keep the point under the cursor fixed while scaling around center origin.
      const ratio = nextScale / prev.scale
      return {
        scale: nextScale,
        x: origin.x * (1 - ratio) + prev.x * ratio,
        y: origin.y * (1 - ratio) + prev.y * ratio,
      }
    })
  }, [])

  const zoomBy = useCallback((factor) => zoomAt(factor, null), [zoomAt])

  const zoomIn = useCallback(() => zoomBy(1.2), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(1 / 1.2), [zoomBy])

  const resetSlideView = useCallback(() => {
    setSlideView(DEFAULT_VIEW)
  }, [])

  const panSlideView = useCallback((dx, dy) => {
    setSlideView((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }))
  }, [])

  const value = useMemo(
    () => ({
      slides,
      currentIndex,
      currentSlide,
      deckName,
      annotationsBySlide,
      annotationTool,
      annotateEnabled,
      annotationColors: ANNOTATION_COLORS,
      annotationStamps: ANNOTATION_STAMPS,
      slideView,
      isImporting,
      importProgress,
      importErrors,
      importFiles,
      clearDeck,
      addWhiteboardSlide,
      goToSlide,
      nextSlide,
      prevSlide,
      setSlideAnnotations,
      clearSlideAnnotations,
      undoSlideAnnotation,
      addTextAnnotation,
      updateTextAnnotation,
      focusTextId,
      setFocusTextId,
      clearAllAnnotations,
      updateAnnotationTool,
      toggleAnnotateEnabled,
      enableAnnotate,
      disableAnnotate,
      clearAllMarks,
      zoomAt,
      zoomIn,
      zoomOut,
      resetSlideView,
      panSlideView,
      slideCount: slides.length,
      canUndoAnnotation: Boolean(
        currentSlide && (annotationUndoBySlide[currentSlide.id] || []).length,
      ),
    }),
    [
      slides,
      currentIndex,
      currentSlide,
      deckName,
      annotationsBySlide,
      annotationUndoBySlide,
      annotationTool,
      annotateEnabled,
      focusTextId,
      slideView,
      isImporting,
      importProgress,
      importErrors,
      importFiles,
      clearDeck,
      addWhiteboardSlide,
      goToSlide,
      nextSlide,
      prevSlide,
      setSlideAnnotations,
      clearSlideAnnotations,
      undoSlideAnnotation,
      addTextAnnotation,
      updateTextAnnotation,
      clearAllAnnotations,
      updateAnnotationTool,
      toggleAnnotateEnabled,
      enableAnnotate,
      disableAnnotate,
      clearAllMarks,
      zoomAt,
      zoomIn,
      zoomOut,
      resetSlideView,
      panSlideView,
    ],
  )

  return (
    <PresentationContext.Provider value={value}>
      {children}
    </PresentationContext.Provider>
  )
}

export function usePresentation() {
  const context = useContext(PresentationContext)
  if (!context) {
    throw new Error('usePresentation must be used within PresentationProvider')
  }
  return context
}
