import { useEffect, useState } from 'react'
import { usePresentation } from '../context/PresentationContext'

/**
 * Previous / next slide controls and deck actions.
 */
export function SlideNav({ viewControls = null }) {
  const {
    currentIndex,
    slideCount,
    deckName,
    prevSlide,
    nextSlide,
    clearDeck,
    clearAllMarks,
    addWhiteboardSlide,
    enableAnnotate,
  } = usePresentation()

  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    setConfirmClear(false)
  }, [slideCount])

  const handleAddWhiteboard = () => {
    addWhiteboardSlide()
    enableAnnotate()
  }

  if (slideCount === 0) {
    return (
      <div className="slide-nav" role="navigation" aria-label="Slide navigation">
        <div className="slide-nav__controls">
          <button
            type="button"
            className="stage-button stage-button--primary"
            onClick={handleAddWhiteboard}
          >
            Whiteboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="slide-nav" role="navigation" aria-label="Slide navigation">
      <div className="slide-nav__meta">
        <span className="slide-nav__deck">{deckName || 'Untitled lesson'}</span>
        <span className="slide-nav__count">
          {currentIndex + 1} / {slideCount}
        </span>
      </div>

      {viewControls}

      <div className="slide-nav__controls">
        <button
          type="button"
          className="stage-button"
          onClick={prevSlide}
          disabled={currentIndex === 0}
          aria-label="Previous slide"
        >
          Prev
        </button>
        <button
          type="button"
          className="stage-button"
          onClick={nextSlide}
          disabled={currentIndex >= slideCount - 1}
          aria-label="Next slide"
        >
          Next
        </button>
        <button
          type="button"
          className="stage-button stage-button--primary"
          onClick={handleAddWhiteboard}
        >
          Whiteboard
        </button>
        <button
          type="button"
          className="stage-button"
          onClick={() => clearAllMarks()}
        >
          Clear marks
        </button>

        {confirmClear ? (
          <div className="slide-nav__confirm" role="group" aria-label="Confirm clear deck">
            <span className="slide-nav__confirm-text">Are you sure?</span>
            <button
              type="button"
              className="stage-button stage-button--danger"
              onClick={() => {
                clearDeck()
                setConfirmClear(false)
              }}
            >
              Yes, clear
            </button>
            <button
              type="button"
              className="stage-button"
              onClick={() => setConfirmClear(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="stage-button stage-button--danger"
            onClick={() => setConfirmClear(true)}
          >
            Clear deck
          </button>
        )}
      </div>
    </div>
  )
}
