import {
  CameraIcon,
  HandIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../components/ui/icons'
import { usePresentation } from '../context/PresentationContext'

/**
 * Camera / view controls for zoom, pan mode, and fit-to-screen.
 */
export function SlideViewControls({ panMode, onPanModeChange }) {
  const { slideView, zoomIn, zoomOut, resetSlideView } = usePresentation()
  const zoomPercent = Math.round(slideView.scale * 100)

  return (
    <div className="slide-view-controls" role="toolbar" aria-label="Slide view">
      <button
        type="button"
        className="stage-button stage-button--icon"
        aria-label="Fit to screen"
        title="Fit to screen"
        onClick={resetSlideView}
      >
        <CameraIcon className="stage-button__icon" />
      </button>
      <button
        type="button"
        className="stage-button stage-button--icon"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={zoomOut}
      >
        <ZoomOutIcon className="stage-button__icon" />
      </button>
      <span className="slide-view-controls__zoom" aria-live="polite">
        {zoomPercent}%
      </span>
      <button
        type="button"
        className="stage-button stage-button--icon"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={zoomIn}
      >
        <ZoomInIcon className="stage-button__icon" />
      </button>
      <button
        type="button"
        className={`stage-button stage-button--icon ${panMode ? 'is-active' : ''}`}
        aria-label="Move slide"
        aria-pressed={panMode}
        title="Move slide"
        onClick={() => onPanModeChange(!panMode)}
      >
        <HandIcon className="stage-button__icon" />
      </button>
    </div>
  )
}
