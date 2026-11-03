import { useRef, useState } from 'react'
import { useTools } from '../context/ToolsContext'
import { RESTROOM_GROUPS } from '../utils/restroomList'

/**
 * Restroom list — Hawaii / Caltech tabs; click a name to mark out (red).
 */
export function BathroomPanel() {
  const { restroom } = useTools()
  const { lists, add, remove, toggle, clear } = restroom
  const [group, setGroup] = useState(RESTROOM_GROUPS[0].id)
  const [nameInput, setNameInput] = useState('')
  const inputRef = useRef(null)

  const names = lists?.[group] || []

  const addName = () => {
    const name = nameInput.trim()
    if (!name) return
    add(group, name)
    setNameInput('')
    inputRef.current?.focus()
  }

  return (
    <div className="bathroom-panel">
      <div
        className="lunch-panel__tabs"
        role="tablist"
        aria-label="Restroom classes"
      >
        {RESTROOM_GROUPS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            className={`lunch-panel__tab ${group === entry.id ? 'is-active' : ''}`}
            aria-selected={group === entry.id}
            onClick={() => setGroup(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

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
                  onClick={() => toggle(group, entry.id)}
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
                  onClick={() => remove(group, entry.id)}
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
          onClick={() => clear(group)}
        >
          Clear all
        </button>
      )}
    </div>
  )
}
