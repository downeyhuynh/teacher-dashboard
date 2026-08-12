import { useRef } from 'react'
import { usePresentation } from '../context/PresentationContext'

/**
 * Drag-and-drop + file picker for PPTX, PDF, and image slide imports.
 */
export function ImportDropzone({ compact = false }) {
  const inputRef = useRef(null)
  const { importFiles, isImporting, importProgress, importErrors } = usePresentation()

  const handleFiles = (fileList) => {
    if (!fileList?.length || isImporting) return
    importFiles(fileList, { append: true })
  }

  const onDrop = (event) => {
    event.preventDefault()
    event.currentTarget.classList.remove('is-dragover')
    handleFiles(event.dataTransfer.files)
  }

  return (
    <div
      className={`import-dropzone ${compact ? 'is-compact' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault()
        event.currentTarget.classList.add('is-dragover')
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault()
        event.currentTarget.classList.remove('is-dragover')
      }}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="import-dropzone__input"
        accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,image/webp,image/gif"
        multiple
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ''
        }}
      />

      {!compact && (
        <>
          <p className="import-dropzone__eyebrow">Lesson materials</p>
          <h2 className="import-dropzone__title">Add a presentation</h2>
          <p className="import-dropzone__copy">
            Drop a PowerPoint (.pptx), PDF, or image exports. Each slide or page
            becomes a high-quality classroom slide.
          </p>
        </>
      )}

      <div className="import-dropzone__actions">
        <button
          type="button"
          className="stage-button stage-button--primary"
          disabled={isImporting}
          onClick={() => inputRef.current?.click()}
        >
          {isImporting ? 'Importing…' : 'Choose PPTX, PDF, or images'}
        </button>
      </div>

      {isImporting && importProgress && (
        <p className="import-dropzone__progress" aria-live="polite">
          Importing {importProgress.fileName}
          {importProgress.total
            ? ` — page ${importProgress.pageNumber} of ${importProgress.total}`
            : ''}
        </p>
      )}

      {importErrors.length > 0 && (
        <ul className="import-dropzone__errors">
          {importErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
