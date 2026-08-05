import { useMemo, useState } from 'react'

const DIGITS = new Set('0123456789')

function sanitizeExpression(expression) {
  return expression.replace(/[^0-9+\-*/().%\s]/g, '')
}

function evaluateExpression(expression) {
  const cleaned = sanitizeExpression(expression).replace(/\s+/g, '')
  if (!cleaned) return 0
  if (!/^[\d+\-*/().%]+$/.test(cleaned)) {
    throw new Error('Invalid expression')
  }

  // Support percent as /100 for classroom use (e.g. 20% → 0.2)
  const withPercent = cleaned.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)')

  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${withPercent})`)()
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Invalid result')
  }
  return result
}

/**
 * Classroom calculator state machine.
 */
export function useCalculator() {
  const [display, setDisplay] = useState('0')
  const [expression, setExpression] = useState('')
  const [justEvaluated, setJustEvaluated] = useState(false)
  const [error, setError] = useState('')

  const inputDigit = (digit) => {
    setError('')
    setDisplay((prev) => {
      if (justEvaluated) {
        setJustEvaluated(false)
        setExpression('')
        return digit
      }
      if (prev === '0') return digit
      if (prev === '-0') return `-${digit}`
      return `${prev}${digit}`
    })
  }

  const inputDot = () => {
    setError('')
    setDisplay((prev) => {
      if (justEvaluated) {
        setJustEvaluated(false)
        setExpression('')
        return '0.'
      }
      if (prev.includes('.')) return prev
      return `${prev}.`
    })
  }

  const inputOperator = (operator) => {
    setError('')
    setJustEvaluated(false)
    setExpression((prev) => {
      const base = justEvaluated ? display : prev + display
      // Replace trailing operator
      if (/[+\-*/]$/.test(base.trim())) {
        return `${base.trim().slice(0, -1)}${operator}`
      }
      return `${base}${operator}`
    })
    setDisplay('0')
  }

  const toggleSign = () => {
    setDisplay((prev) => {
      if (prev === '0') return prev
      return prev.startsWith('-') ? prev.slice(1) : `-${prev}`
    })
  }

  const backspace = () => {
    if (justEvaluated) return
    setDisplay((prev) => {
      if (prev.length <= 1 || (prev.length === 2 && prev.startsWith('-'))) return '0'
      return prev.slice(0, -1)
    })
  }

  const clearAll = () => {
    setDisplay('0')
    setExpression('')
    setJustEvaluated(false)
    setError('')
  }

  const equals = () => {
    try {
      const full = `${expression}${display}`
      const result = evaluateExpression(full)
      const formatted = Number.parseFloat(result.toPrecision(12)).toString()
      setDisplay(formatted)
      setExpression('')
      setJustEvaluated(true)
      setError('')
    } catch {
      setError('Error')
      setJustEvaluated(true)
    }
  }

  const press = (key) => {
    if (DIGITS.has(key)) inputDigit(key)
    else if (key === '.') inputDot()
    else if (key === '+' || key === '-' || key === '*' || key === '/') inputOperator(key)
    else if (key === '=') equals()
    else if (key === 'C') clearAll()
    else if (key === '⌫') backspace()
    else if (key === '±') toggleSign()
    else if (key === '%') {
      setDisplay((prev) => {
        const value = Number(prev) / 100
        return Number.isFinite(value)
          ? Number.parseFloat(value.toPrecision(12)).toString()
          : prev
      })
    }
  }

  const shownExpression = useMemo(() => {
    if (error) return error
    if (!expression) return ''
    return expression.replace(/\*/g, '×').replace(/\//g, '÷')
  }, [error, expression])

  return {
    display: error || display,
    expression: shownExpression,
    press,
    clearAll,
  }
}
