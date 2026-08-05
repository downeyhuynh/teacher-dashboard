import { useCalculator } from '../hooks/useCalculator'

const KEYS = [
  ['C', '⌫', '%', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['±', '0', '.', '='],
]

function labelFor(key) {
  if (key === '*') return '×'
  if (key === '/') return '÷'
  return key
}

export function CalculatorPanel() {
  const { display, expression, press } = useCalculator()

  return (
    <div className="calculator-panel">
      <div className="calculator-panel__screen">
        <div className="calculator-panel__expression">{expression || '\u00A0'}</div>
        <div className="calculator-panel__display" aria-live="polite">
          {display}
        </div>
      </div>

      <div className="calculator-panel__keys">
        {KEYS.flat().map((key) => {
          const isOp = ['/', '*', '-', '+', '='].includes(key)
          const isAccent = key === '='
          const isMuted = key === 'C' || key === '⌫' || key === '%' || key === '±'

          return (
            <button
              type="button"
              key={key}
              className={[
                'calculator-panel__key',
                isOp ? 'is-op' : '',
                isAccent ? 'is-accent' : '',
                isMuted ? 'is-muted' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => press(key)}
            >
              {labelFor(key)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
