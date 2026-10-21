import { useRef, useState } from 'react'
import { useTools } from '../context/ToolsContext'

/**
 * Lunch recovery list — type a name to show who is serving.
 */
export function LunchRecoveryPanel() {
  const { lunchRecovery } = useTools()
  const { names, add, adjustStrikes, remove, clear } = lunchRecovery
  const [nameInput, setNameInput] = useState('')
  const inputRef = useRef(null)

  const addName = () => {
    const name = nameInput.trim()
    if (!name) return
    add(name)
    setNameInput('')
    inputRef.current?.focus()
  }

  return (
    <div className="bathroom-panel lunch-panel">
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
          <p className="bathroom-panel__empty">No one serving lunch</p>
        ) : (
          <ul className="bathroom-panel__items">
            {names.map((entry) => {
              const strikes = entry.strikes || 0
              return (
                <li key={entry.id} className="bathroom-panel__item">
                  <strong className="bathroom-panel__name lunch-panel__name">{entry.name}</strong>
                  <div className="lunch-panel__strikes" role="group" aria-label={`${entry.name} strikes`}>
                    <button
                      type="button"
                      className="stage-button lunch-panel__strike-btn"
                      onClick={() => adjustStrikes(entry.id, -1)}
                      disabled={strikes <= 0}
                      aria-label={`Remove a strike from ${entry.name}`}
                    >
                      −
                    </button>
                    <span className="lunch-panel__strike-count" aria-label={`${strikes} strikes`}>
                      {strikes}
                    </span>
                    <button
                      type="button"
                      className="stage-button lunch-panel__strike-btn"
                      onClick={() => adjustStrikes(entry.id, 1)}
                      aria-label={`Add a strike for ${entry.name}`}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="stage-button"
                    onClick={() => remove(entry.id)}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
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
