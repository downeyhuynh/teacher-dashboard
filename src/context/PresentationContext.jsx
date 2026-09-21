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

function createDeck({ name = 'Lesson', slides = [] } = {}) {
  return {
    id: createId('deck'),
    name,
    slides,
    currentIndex: 0,
    annotationsBySlide: {},
    annotationUndoBySlide: {},
    slideView: { ...DEFAULT_VIEW },
  }
}

const PresentationContext = createContext(null)

export function PresentationProvider({ children }) {
  const [decks, setDecks] = useState([])
  const [activeDeckId, setActiveDeckId] = useState(null)
  const annotationsRef = useRef({})
  const annotationUndoRef = useRef({})
  const activeDeckIdRef = useRef(null)
  const [annotationTool, setAnnotationTool] = useState(defaultInkTool)
  const [annotateEnabled, setAnnotateEnabled] = useState(false)
  const [focusTextId, setFocusTextId] = useState(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const [importErrors, setImportErrors] = useState([])

  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? null
  activeDeckIdRef.current = activeDeck?.id ?? null

  const slides = activeDeck?.slides ?? []
  const currentIndex = activeDeck?.currentIndex ?? 0
  const deckName = activeDeck?.name ?? ''
  const annotationsBySlide = activeDeck?.annotationsBySlide ?? {}
  const annotationUndoBySlide = activeDeck?.annotationUndoBySlide ?? {}
  const slideView = activeDeck?.slideView ?? DEFAULT_VIEW
  const currentSlide = slides[currentIndex] ?? null

  // Keep annotation refs aligned with the active deck for drawing helpers.
  annotationsRef.current = annotationsBySlide
  annotationUndoRef.current = annotationUndoBySlide

  const patchActiveDeck = useCallback((patch) => {
    const id = activeDeckIdRef.current
    if (!id) return
    setDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== id) return deck
        const nextPatch = typeof patch === 'function' ? patch(deck) : patch
        return { ...deck, ...nextPatch }
      }),
    )
  }, [])

  const selectDeck = useCallback((deckId) => {
    setActiveDeckId(deckId)
    setFocusTextId(null)
  }, [])

  const closeDeck = useCallback((deckId) => {
    setDecks((prev) => {
      const target = prev.find((deck) => deck.id === deckId)
      if (target) revokeSlideUrls(target.slides)
      const next = prev.filter((deck) => deck.id !== deckId)
      setActiveDeckId((current) => {
        if (current !== deckId) return current
        return next[0]?.id ?? null
      })
      return next
    })
    setFocusTextId(null)
  }, [])

  const importFiles = useCallback(async (fileList, { append = true } = {}) => {
    if (!fileList?.length) return

    setIsImporting(true)
    setImportErrors([])
    setImportProgress({ fileName: '', pageNumber: 0, total: 0 })

    try {
      const files = Array.from(fileList)
      const createdDecks = []
      const errors = []

      for (const file of files) {
        const result = await importPresentationFiles([file], {
          onProgress: setImportProgress,
        })
        if (result.errors.length) {
          errors.push(...result.errors)
        }
        if (!result.slides.length) continue
        createdDecks.push(
          createDeck({
            name: file.name.replace(/\.[^.]+$/, '') || 'Lesson',
            slides: result.slides,
          }),
        )
      }

      if (errors.length) {
        setImportErrors(errors)
      }
      if (!createdDecks.length) return

      setDecks((prev) => {
        if (!append && prev.length) {
          for (const deck of prev) revokeSlideUrls(deck.slides)
          return createdDecks
        }
        return [...prev, ...createdDecks]
      })
      setActiveDeckId(createdDecks[createdDecks.length - 1].id)
      setFocusTextId(null)
    } finally {
      setIsImporting(false)
      setImportProgress(null)
    }
  }, [])

  const clearDeck = useCallback(() => {
    const id = activeDeckIdRef.current
    if (!id) {
      setDecks((prev) => {
        for (const deck of prev) revokeSlideUrls(deck.slides)
        return []
      })
      setActiveDeckId(null)
      setImportErrors([])
      setFocusTextId(null)
      return
    }
    closeDeck(id)
    setImportErrors([])
  }, [closeDeck])

  /** Insert a blank whiteboard after the current slide and jump to it. */
  const addWhiteboardSlide = useCallback(() => {
    const board = createWhiteboardSlide()
    const id = activeDeckIdRef.current

    if (!id) {
      const deck = createDeck({ name: 'Lesson', slides: [board] })
      setDecks([deck])
      setActiveDeckId(deck.id)
      setFocusTextId(null)
      return
    }

    patchActiveDeck((deck) => {
      const insertAt = Math.min(deck.currentIndex + 1, deck.slides.length)
      const slidesNext = [
        ...deck.slides.slice(0, insertAt),
        board,
        ...deck.slides.slice(insertAt),
      ]
      return {
        slides: slidesNext,
        currentIndex: insertAt,
        slideView: { ...DEFAULT_VIEW },
        name: deck.name || 'Lesson',
      }
    })
  }, [patchActiveDeck])

  const goToSlide = useCallback(
    (index) => {
      patchActiveDeck((deck) => ({
        currentIndex: Math.min(
          Math.max(0, index),
          Math.max(0, deck.slides.length - 1),
        ),
      }))
    },
    [patchActiveDeck],
  )

  const nextSlide = useCallback(() => {
    patchActiveDeck((deck) => ({
      currentIndex: Math.min(
        deck.currentIndex + 1,
        Math.max(0, deck.slides.length - 1),
      ),
    }))
  }, [patchActiveDeck])

  const prevSlide = useCallback(() => {
    patchActiveDeck((deck) => ({
      currentIndex: Math.max(deck.currentIndex - 1, 0),
    }))
  }, [patchActiveDeck])

  const pushAnnotationUndo = useCallback((slideId, marks) => {
    const id = activeDeckIdRef.current
    if (!id) return
    setDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== id) return deck
        const stack = deck.annotationUndoBySlide[slideId] || []
        const annotationUndoBySlide = {
          ...deck.annotationUndoBySlide,
          [slideId]: [...stack, marks].slice(-MAX_UNDO),
        }
        annotationUndoRef.current = annotationUndoBySlide
        return { ...deck, annotationUndoBySlide }
      }),
    )
  }, [])

  const replaceAnnotations = useCallback((next) => {
    annotationsRef.current = next
    const id = activeDeckIdRef.current
    if (!id) return
    setDecks((prev) =>
      prev.map((deck) =>
        deck.id === id ? { ...deck, annotationsBySlide: next } : deck,
      ),
    )
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
      const id = activeDeckIdRef.current
      if (!id) return

      setDecks((prev) =>
        prev.map((deck) => {
          if (deck.id !== id) return deck
          const stack = deck.annotationUndoBySlide[slideId] || []
          if (!stack.length) return deck
          const previous = stack[stack.length - 1]
          const annotationUndoBySlide = {
            ...deck.annotationUndoBySlide,
            [slideId]: stack.slice(0, -1),
          }
          const annotationsBySlide = {
            ...deck.annotationsBySlide,
            [slideId]: previous,
          }
          annotationUndoRef.current = annotationUndoBySlide
          annotationsRef.current = annotationsBySlide
          return { ...deck, annotationUndoBySlide, annotationsBySlide }
        }),
      )
      setFocusTextId(null)
    },
    [],
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
    patchActiveDeck({
      annotationsBySlide: {},
      annotationUndoBySlide: {},
    })
    setFocusTextId(null)
  }, [patchActiveDeck])

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
    clearAllAnnotations()
  }, [clearAllAnnotations])

  const zoomAt = useCallback(
    (factor, origin = null) => {
      patchActiveDeck((deck) => {
        const prev = deck.slideView || DEFAULT_VIEW
        const nextScale = clamp(Number((prev.scale * factor).toFixed(3)), 0.4, 4)
        if (!origin || nextScale === prev.scale) {
          return { slideView: { ...prev, scale: nextScale } }
        }
        const ratio = nextScale / prev.scale
        return {
          slideView: {
            scale: nextScale,
            x: origin.x * (1 - ratio) + prev.x * ratio,
            y: origin.y * (1 - ratio) + prev.y * ratio,
          },
        }
      })
    },
    [patchActiveDeck],
  )

  const zoomBy = useCallback((factor) => zoomAt(factor, null), [zoomAt])
  const zoomIn = useCallback(() => zoomBy(1.2), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(1 / 1.2), [zoomBy])

  const resetSlideView = useCallback(() => {
    patchActiveDeck({ slideView: { ...DEFAULT_VIEW } })
  }, [patchActiveDeck])

  const panSlideView = useCallback(
    (dx, dy) => {
      patchActiveDeck((deck) => {
        const prev = deck.slideView || DEFAULT_VIEW
        return {
          slideView: {
            ...prev,
            x: prev.x + dx,
            y: prev.y + dy,
          },
        }
      })
    },
    [patchActiveDeck],
  )

  const value = useMemo(
    () => ({
      decks,
      activeDeckId,
      selectDeck,
      closeDeck,
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
      decks,
      activeDeckId,
      selectDeck,
      closeDeck,
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
