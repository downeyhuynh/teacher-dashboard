import { usePresentation } from '../../context/PresentationContext'

/**
 * Top tab strip for switching between opened PDF / PPTX decks.
 */
export function DeckTabs() {
  const { decks, activeDeckId, selectDeck, closeDeck } = usePresentation()

  if (!decks.length) return null

  return (
    <div className="deck-tabs" role="tablist" aria-label="Open presentations">
      {decks.map((deck) => {
        const active = deck.id === activeDeckId
        return (
          <div
            key={deck.id}
            className={`deck-tabs__tab ${active ? 'is-active' : ''}`}
          >
            <button
              type="button"
              role="tab"
              className="deck-tabs__button"
              aria-selected={active}
              title={deck.name}
              onClick={() => selectDeck(deck.id)}
            >
              {deck.name || 'Untitled'}
            </button>
            <button
              type="button"
              className="deck-tabs__close"
              aria-label={`Close ${deck.name || 'presentation'}`}
              title="Close"
              onClick={(event) => {
                event.stopPropagation()
                closeDeck(deck.id)
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
