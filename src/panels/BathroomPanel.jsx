import { useRef, useState } from 'react'
import { useTools } from '../context/ToolsContext'

/**
 * Restroom list — add names, click a name to highlight red when they are out.
 */
export function BathroomPanel() {
  const { restroom } = useTools()
  const { out: names, add, remove, toggle, clear } = restroom
  const [nameInput, setNameInput] = useState('')
  const inputRef = useRef(null)

  const addName = () => {
    const name = nameInput.trim()
    if (!name) return
    add(name)
    setNameInput('')
    // Keep focus for rapid entry; Escape / click-outside blurs so shortcuts work.
    inputRef.current?.focus()
  }

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
          placeholder="Student name"
          aria-label="Student name"
          autoComplete="off"
          onChange={(event) => setNameInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
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
          <p className="bathroom-panel__empty">No one on the list</p>
        ) : (
          <ul className="bathroom-panel__items">
            {names.map((entry) => (
              <li
                key={entry.id}
                className={`bathroom-panel__item ${entry.out ? 'is-out' : ''}`}
              >
                <button
                  type="button"
                  className="bathroom-panel__name-btn"
                  onClick={() => toggle(entry.id)}
                  aria-pressed={Boolean(entry.out)}
                  title={
                    entry.out
                      ? 'Click to clear out highlight'
                      : 'Click to mark out (red)'
                  }
                >
                  <strong className="bathroom-panel__name">{entry.name}</strong>
                </button>
                <button
                  type="button"
                  className="stage-button"
                  onClick={() => remove(entry.id)}
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
          onClick={clear}
        >
          Clear all
        </button>
      )}
    </div>
  )
}
