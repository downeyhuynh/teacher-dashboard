import { usePresentation } from '../context/PresentationContext'

function StampPreview({ symbol }) {
  return (
    <svg className="stamp-chip__icon" viewBox="0 0 24 24" aria-hidden="true">
      {symbol === 'check' && (
        <path
          d="M5 12.5l4 4L19 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {symbol === 'cross' && (
        <path
          d="M7 7l10 10M17 7L7 17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      )}
      {symbol === 'star' && (
        <path
          d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18.4l.9-5.4L4.2 9.2l5.4-.8z"
          fill="currentColor"
        />
      )}
      {symbol === 'arrow' && (
        <path
          d="M4 12h12M12 7l5 5-5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {symbol === 'question' && (
        <>
          <path
            d="M9 8.5a3 3 0 1 1 4.2 2.7c-.8.5-1.2 1-1.2 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="17.5" r="1.2" fill="currentColor" />
        </>
      )}
    </svg>
  )
}

export function AnnotatePanel() {
  const {
    annotationTool,
    annotationColors,
    annotationStamps,
    updateAnnotationTool,
    currentSlide,
    clearSlideAnnotations,
    undoSlideAnnotation,
    addTextAnnotation,
    canUndoAnnotation,
    slideCount,
  } = usePresentation()

  return (
    <div className="annotate-panel">
      <p className="tool-panel__hint">
        {slideCount === 0
          ? 'Import a presentation first, then draw on slides from this panel.'
          : 'Draw on the slide while Annotate is on. P = pen, E = eraser, T = text. In text: Ctrl+B bold, Ctrl+I italic, Ctrl+U underline. Hold Shift for a straight line. Ctrl+Z undoes draws and erases.'}
      </p>

      <div className="tool-panel__row">
        <button
          type="button"
          className="stage-button"
          disabled={!canUndoAnnotation}
          onClick={() => currentSlide && undoSlideAnnotation(currentSlide.id)}
        >
          Undo
        </button>
        <button
          type="button"
          className="stage-button stage-button--danger"
          disabled={!currentSlide}
          onClick={() => currentSlide && clearSlideAnnotations(currentSlide.id)}
        >
          Clear slide
        </button>
      </div>

      <div className="tool-panel__section">
        <span className="tool-panel__label">Tool</span>
        <div className="tool-panel__row">
          <button
            type="button"
            className={`tool-chip ${annotationTool.mode === 'pen' ? 'is-active' : ''}`}
            onClick={() => updateAnnotationTool({ mode: 'pen' })}
          >
            Pen
          </button>
          <button
            type="button"
            className={`tool-chip ${annotationTool.mode === 'eraser' ? 'is-active' : ''}`}
            onClick={() => updateAnnotationTool({ mode: 'eraser' })}
          >
            Eraser
          </button>
          <button
            type="button"
            className={`tool-chip ${annotationTool.mode === 'text' ? 'is-active' : ''}`}
            onClick={() => {
              if (currentSlide) addTextAnnotation(currentSlide.id)
              else updateAnnotationTool({ mode: 'text' })
            }}
          >
            Text
          </button>
        </div>
      </div>

      <div className="tool-panel__section">
        <span className="tool-panel__label">Symbols</span>
        <div className="stamp-row" role="listbox" aria-label="Stamp symbols">
          {annotationStamps.map((stamp) => {
            const isActive =
              annotationTool.mode === 'stamp' && annotationTool.stamp === stamp.id
            return (
              <button
                type="button"
                key={stamp.id}
                className={`stamp-chip ${isActive ? 'is-active' : ''}`}
                aria-label={stamp.label}
                aria-selected={isActive}
                title={stamp.label}
                onClick={() =>
                  updateAnnotationTool({ mode: 'stamp', stamp: stamp.id })
                }
              >
                <StampPreview symbol={stamp.id} />
              </button>
            )
          })}
        </div>
        <p className="tool-panel__hint">
          Select a symbol, then click the slide to place it.
        </p>
      </div>

      <div className="tool-panel__section">
        <span className="tool-panel__label">Color</span>
        <div className="swatch-row" role="listbox" aria-label="Annotation color">
          {annotationColors.map((color) => (
            <button
              type="button"
              key={color}
              className={`swatch ${annotationTool.color === color ? 'is-active' : ''}`}
              style={{ background: color }}
              aria-label={`Color ${color}`}
              aria-selected={annotationTool.color === color}
              onClick={() =>
                updateAnnotationTool({
                  color,
                  mode: annotationTool.mode === 'eraser' ? 'pen' : annotationTool.mode,
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="tool-panel__section">
        <label className="tool-panel__label" htmlFor="annotate-width">
          {annotationTool.mode === 'stamp'
            ? 'Symbol size'
            : annotationTool.mode === 'text'
              ? 'Text size'
              : 'Thickness'}
        </label>
        <input
          id="annotate-width"
          type="range"
          min="1"
          max="16"
          value={annotationTool.width}
          onChange={(event) =>
            updateAnnotationTool({ width: Number(event.target.value) })
          }
        />
      </div>
    </div>
  )
}
