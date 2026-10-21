import { useEffect, useRef, useState } from 'react'
import { usePresentation } from '../context/PresentationContext'
import { youtubeVideoId } from '../utils/youtube'

function VideoLink({ onPlay }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setUrl('')
    setError('')
  }

  if (!open) {
    return (
      <button type="button" className="stage-button" onClick={() => setOpen(true)}>
        Video
      </button>
    )
  }

  return (
    <form
      className="slide-nav__video"
      onSubmit={(event) => {
        event.preventDefault()
        if (!youtubeVideoId(url)) {
          setError('Paste a YouTube link')
          return
        }
        const played = onPlay(url)
        if (!played) {
          setError('Paste a YouTube link')
          return
        }
        close()
      }}
    >
      <input
        ref={inputRef}
        className="slide-nav__video-input"
        type="url"
        inputMode="url"
        value={url}
        placeholder="YouTube link"
        aria-label="YouTube link"
        autoComplete="off"
        onChange={(event) => {
          setUrl(event.target.value)
          setError('')
        }}
      />
      <button type="submit" className="stage-button stage-button--primary" disabled={!url.trim()}>
        Play
      </button>
      <button type="button" className="stage-button" onClick={close}>
        Cancel
      </button>
      {error ? <span className="slide-nav__video-error">{error}</span> : null}
    </form>
  )
}

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
    addYoutubeSlide,
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
          <VideoLink onPlay={addYoutubeSlide} />
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
        <VideoLink onPlay={addYoutubeSlide} />
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
