import { useEffect, useRef, useState } from 'react'
import { createId } from '../utils/id'

/**
 * Simple restroom list: add student names, remove when they return.
 */
export function BathroomPanel() {
  const [nameInput, setNameInput] = useState('')
  const [names, setNames] = useState([])
  const inputRef = useRef(null)

  const addName = () => {
    const name = nameInput.trim()
    if (!name) return
    setNames((prev) => [{ id: createId('restroom'), name }, ...prev])
    setNameInput('')
    inputRef.current?.focus()
  }

  const removeName = (id) => {
    setNames((prev) => prev.filter((entry) => entry.id !== id))
  }

  const clearAll = () => setNames([])

  return (
    <div className="bathroom-panel">
      <form
        className="bathroom-panel__add"
        onSubmit={(event) => {
          event.preventDefault()
          addName()
        }}
      >
        <input
          ref={inputRef}
          className="bathroom-panel__input"
          type="text"
          value={nameInput}
          onChange={(event) => setNameInput(event.target.value)}
          placeholder="Student name"
          aria-label="Student name"
          autoComplete="off"
        />
        <button
          type="submit"
          className="stage-button stage-button--primary"
          disabled={!nameInput.trim()}
        >
          Add
        </button>
      </form>

      <div className="bathroom-panel__list" aria-live="polite">
        {names.length === 0 ? (
          <p className="bathroom-panel__empty">No one is out</p>
        ) : (
          <ul className="bathroom-panel__items">
            {names.map((entry) => (
              <li key={entry.id} className="bathroom-panel__item">
                <strong className="bathroom-panel__name">{entry.name}</strong>
                <button
                  type="button"
                  className="stage-button"
                  onClick={() => removeName(entry.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {names.length > 0 && (
        <button
          type="button"
          className="stage-button bathroom-panel__clear"
          onClick={clearAll}
        >
          Clear all
        </button>
      )}
    </div>
  )
}
