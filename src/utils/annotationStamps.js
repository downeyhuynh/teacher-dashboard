/**
 * Placeable annotation stamp symbols.
 */
export const ANNOTATION_STAMPS = [
  { id: 'check', label: 'Check' },
  { id: 'cross', label: 'Cross' },
  { id: 'star', label: 'Star' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'question', label: 'Question' },
]

/**
 * Draw a stamp symbol centered at (x, y).
 */
export function drawStamp(ctx, stamp) {
  const { x, y, size = 28, color = '#c0392b', symbol = 'check' } = stamp
  const s = size

  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(2.5, s * 0.12)

  switch (symbol) {
    case 'check': {
      ctx.beginPath()
      ctx.moveTo(-s * 0.35, 0)
      ctx.lineTo(-s * 0.08, s * 0.28)
      ctx.lineTo(s * 0.38, -s * 0.32)
      ctx.stroke()
      break
    }
    case 'cross': {
      ctx.beginPath()
      ctx.moveTo(-s * 0.3, -s * 0.3)
      ctx.lineTo(s * 0.3, s * 0.3)
      ctx.moveTo(s * 0.3, -s * 0.3)
      ctx.lineTo(-s * 0.3, s * 0.3)
      ctx.stroke()
      break
    }
    case 'star': {
      const spikes = 5
      const outer = s * 0.4
      const inner = s * 0.18
      ctx.beginPath()
      for (let i = 0; i < spikes * 2; i += 1) {
        const radius = i % 2 === 0 ? outer : inner
        const angle = (i * Math.PI) / spikes - Math.PI / 2
        const px = Math.cos(angle) * radius
        const py = Math.sin(angle) * radius
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'arrow': {
      ctx.beginPath()
      ctx.moveTo(-s * 0.35, 0)
      ctx.lineTo(s * 0.2, 0)
      ctx.moveTo(s * 0.05, -s * 0.22)
      ctx.lineTo(s * 0.35, 0)
      ctx.lineTo(s * 0.05, s * 0.22)
      ctx.stroke()
      break
    }
    case 'question': {
      ctx.beginPath()
      ctx.arc(0, -s * 0.12, s * 0.2, Math.PI * 0.85, Math.PI * 2.15)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, s * 0.08)
      ctx.lineTo(0, s * 0.16)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, s * 0.3, Math.max(1.5, s * 0.05), 0, Math.PI * 2)
      ctx.fill()
      break
    }
    default:
      break
  }

  ctx.restore()
}
