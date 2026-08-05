import { useEffect, useMemo, useRef, useState } from 'react'

const WHEEL_COLORS = [
  '#0d7a6f',
  '#1a2332',
  '#2f6f8f',
  '#3d8b7a',
  '#245b72',
  '#4a6b5d',
]

function polar(cx, cy, radius, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

function segmentPath(cx, cy, radius, startAngle, endAngle) {
  const sweep = endAngle - startAngle
  if (sweep >= 359.9) {
    return [
      `M ${cx} ${cy - radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`,
      'Z',
    ].join(' ')
  }

  const start = polar(cx, cy, radius, endAngle)
  const end = polar(cx, cy, radius, startAngle)
  const largeArc = sweep > 180 ? 1 : 0

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ')
}

function normalizeDeg(value) {
  return ((value % 360) + 360) % 360
}

/** First + last initial, or first two letters of a single name. */
export function getStudentInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  const first = parts[0][0] || ''
  const last = parts[parts.length - 1][0] || ''
  return `${first}${last}`.toUpperCase()
}

/**
 * Classroom spin wheel. Lands the target index under the top pointer.
 */
export function SpinWheel({
  names = [],
  targetIndex = null,
  spinning = false,
  onSpinEnd,
  onSpinRequest,
  durationMs = 4200,
  labelMode = 'auto', // auto | name | initials
  size = 'default', // default | large
}) {
  const [rotation, setRotation] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const rotationRef = useRef(0)
  const endTimerRef = useRef(null)
  const spinGenerationRef = useRef(0)

  useEffect(() => {
    rotationRef.current = rotation
  }, [rotation])

  useEffect(() => {
    return () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!spinning || targetIndex == null || names.length === 0) return undefined

    const generation = spinGenerationRef.current + 1
    spinGenerationRef.current = generation

    const slice = 360 / names.length
    const centerAngle = targetIndex * slice + slice / 2
    const targetMod = normalizeDeg(360 - centerAngle)
    const currentMod = normalizeDeg(rotationRef.current)
    const spins = 5 + Math.floor(Math.random() * 2)
    let delta = normalizeDeg(targetMod - currentMod)
    if (delta < 20) delta += 360
    delta += spins * 360

    const nextRotation = rotationRef.current + delta

    setIsAnimating(true)
    requestAnimationFrame(() => {
      setRotation(nextRotation)
    })

    endTimerRef.current = setTimeout(() => {
      if (spinGenerationRef.current !== generation) return
      setIsAnimating(false)
      onSpinEnd?.()
    }, durationMs)

    return () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
    }
  }, [spinning, targetIndex, names.length, durationMs, onSpinEnd])

  const segments = useMemo(() => {
    if (!names.length) return []
    const slice = 360 / names.length
    const useInitials =
      labelMode === 'initials' || (labelMode === 'auto' && names.length > 14)
    const showLabels =
      labelMode === 'initials' ||
      labelMode === 'name' ||
      names.length <= 18 ||
      useInitials

    return names.map((name, index) => {
      const startAngle = index * slice
      const endAngle = (index + 1) * slice
      const midAngle = startAngle + slice / 2
      const labelPos = polar(100, 100, names.length <= 6 ? 58 : 62, midAngle)
      const rawLabel = useInitials
        ? getStudentInitials(name)
        : name.length > 10
          ? `${name.slice(0, 9)}…`
          : name

      return {
        id: `${name}-${index}`,
        label: rawLabel,
        showLabels,
        path: segmentPath(100, 100, 95, startAngle, endAngle),
        color: WHEEL_COLORS[index % WHEEL_COLORS.length],
        labelPos,
        midAngle,
      }
    })
  }, [names, labelMode])

  if (!names.length) {
    return (
      <div className={`spin-wheel spin-wheel--empty spin-wheel--${size}`}>
        <p>Add students to spin the wheel</p>
      </div>
    )
  }

  const fontSize =
    labelMode === 'initials'
      ? names.length > 24
        ? 7
        : names.length > 16
          ? 8.5
          : 11
      : names.length > 10
        ? 6.5
        : 8

  const canClickSpin = Boolean(onSpinRequest) && !spinning && !isAnimating

  return (
    <button
      type="button"
      className={`spin-wheel spin-wheel--${size} ${isAnimating ? 'is-spinning' : ''} ${
        canClickSpin ? 'is-clickable' : ''
      }`}
      aria-label={canClickSpin ? 'Spin the wheel' : 'Student wheel'}
      disabled={!canClickSpin && Boolean(onSpinRequest)}
      onClick={() => {
        if (!canClickSpin) return
        onSpinRequest()
      }}
    >
      <div className="spin-wheel__pointer" aria-hidden="true" />
      <div
        className="spin-wheel__rotor"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isAnimating
            ? `transform ${durationMs}ms cubic-bezier(0.12, 0.7, 0.08, 1)`
            : 'none',
        }}
      >
        <svg className="spin-wheel__svg" viewBox="0 0 200 200" role="img" aria-hidden="true">
          {segments.map((segment) => (
            <g key={segment.id}>
              <path d={segment.path} fill={segment.color} stroke="#f4f7fa" strokeWidth="1.5" />
              {segment.showLabels && (
                <text
                  x={segment.labelPos.x}
                  y={segment.labelPos.y}
                  fill="#f7f9fc"
                  fontSize={fontSize}
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${segment.midAngle}, ${segment.labelPos.x}, ${segment.labelPos.y})`}
                >
                  {segment.label}
                </text>
              )}
            </g>
          ))}
          <circle cx="100" cy="100" r="18" fill="#f4f7fa" />
          <circle cx="100" cy="100" r="10" fill="#0d7a6f" />
        </svg>
      </div>
    </button>
  )
}
