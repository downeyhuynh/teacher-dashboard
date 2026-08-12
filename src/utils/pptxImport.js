import { parse as parsePptx } from 'pptxtojson'
import { createId } from './id'

const RENDER_SCALE = 2

function cssSize(pt, scale = RENDER_SCALE) {
  return `${Math.round(Number(pt || 0) * scale)}px`
}

function resolveImageSrc(element) {
  if (element?.base64) {
    return String(element.base64).startsWith('data:')
      ? element.base64
      : `data:image/png;base64,${element.base64}`
  }
  if (element?.src) return element.src
  return null
}

function scaleRichTextHtml(html, scale = RENDER_SCALE) {
  if (!html) return ''
  return String(html)
    .replace(/font-size:\s*([\d.]+)pt/gi, (_, value) => {
      return `font-size: ${(parseFloat(value) * scale).toFixed(2)}pt`
    })
    .replace(/font-size:\s*([\d.]+)px/gi, (_, value) => {
      return `font-size: ${(parseFloat(value) * scale).toFixed(2)}px`
    })
}

function applyFill(target, fill) {
  if (!fill) return
  if (fill.type === 'color' && fill.value) {
    target.style.background = fill.value
    return
  }
  if (fill.type === 'image') {
    const src = fill.base64 || fill.picBase64 || fill.value
    if (!src) return
    const url = String(src).startsWith('data:') ? src : `data:image/png;base64,${src}`
    target.style.backgroundImage = `url("${url}")`
    target.style.backgroundSize = 'cover'
    target.style.backgroundPosition = 'center'
  }
}

function createElementNode(element, scale = RENDER_SCALE) {
  const node = document.createElement('div')
  node.style.position = 'absolute'
  node.style.left = cssSize(element.left, scale)
  node.style.top = cssSize(element.top, scale)
  node.style.width = cssSize(element.width, scale)
  node.style.height = cssSize(element.height, scale)
  node.style.boxSizing = 'border-box'
  node.style.overflow = 'hidden'
  if (element.rotate) {
    node.style.transform = `rotate(${element.rotate}deg)`
    node.style.transformOrigin = 'center center'
  }

  if (element.borderWidth && element.borderColor) {
    node.style.border = `${Math.max(1, element.borderWidth * scale)}px ${
      element.borderType || 'solid'
    } ${element.borderColor}`
  }

  if (element.type === 'image') {
    const src = resolveImageSrc(element)
    if (src) {
      const img = document.createElement('img')
      img.src = src
      img.alt = element.name || ''
      img.style.width = '100%'
      img.style.height = '100%'
      img.style.objectFit = 'fill'
      img.style.display = 'block'
      node.appendChild(img)
    }
    return node
  }

  applyFill(node, element.fill)

  if (element.type === 'text' || element.content) {
    node.style.display = 'flex'
    node.style.flexDirection = 'column'
    node.style.justifyContent =
      element.vAlign === 'top' ? 'flex-start' : element.vAlign === 'bot' || element.vAlign === 'bottom'
        ? 'flex-end'
        : 'center'
    const body = document.createElement('div')
    body.style.width = '100%'
    body.style.lineHeight = '1.25'
    body.innerHTML = scaleRichTextHtml(element.content, scale)
    node.appendChild(body)
  }

  return node
}

async function waitForImages(root) {
  const images = [...root.querySelectorAll('img')]
  await Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }),
    ),
  )
}

async function rasterizeDom(root, width, height) {
  await waitForImages(root)
  await document.fonts?.ready?.catch?.(() => {})

  const serialized = new XMLSerializer().serializeToString(root)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    ${serialized}
  </foreignObject>
</svg>`

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const image = new Image()
  image.decoding = 'async'
  await new Promise((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Failed to rasterize PPTX slide'))
    image.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Could not create canvas for PPTX slide')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result)
        else reject(new Error('Failed to encode PPTX slide image'))
      },
      'image/png',
    )
  })

  return URL.createObjectURL(blob)
}

function buildSlideDom(slide, width, height, scale = RENDER_SCALE) {
  const root = document.createElement('div')
  root.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  root.style.width = `${width}px`
  root.style.height = `${height}px`
  root.style.position = 'relative'
  root.style.overflow = 'hidden'
  root.style.background = '#ffffff'
  root.style.fontFamily = 'Calibri, Arial, sans-serif'
  root.style.color = '#1a2332'

  applyFill(root, slide.fill)

  const layers = [...(slide.layoutElements || []), ...(slide.elements || [])]
  for (const element of layers) {
    if (!element || element.type === 'video' || element.type === 'audio') continue
    root.appendChild(createElementNode(element, scale))
  }

  return root
}

/**
 * Convert a PPTX file into high-resolution PNG slide images.
 * @returns {Promise<import('./presentationImport').Slide[]>}
 */
export async function slidesFromPptx(file, { onProgress } = {}) {
  const buffer = await file.arrayBuffer()
  const json = await parsePptx(buffer, {
    imageMode: 'base64',
    videoMode: 'none',
    audioMode: 'none',
  })

  const slideWidthPt = json?.size?.width || 960
  const slideHeightPt = json?.size?.height || 540
  const width = Math.round(slideWidthPt * RENDER_SCALE)
  const height = Math.round(slideHeightPt * RENDER_SCALE)
  const slides = Array.isArray(json?.slides) ? json.slides : []
  const result = []

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index]
    const root = buildSlideDom(slide, width, height, RENDER_SCALE)
    const src = await rasterizeDom(root, width, height)
    result.push({
      id: createId('slide'),
      source: 'pptx',
      name: `${file.name} — p.${index + 1}`,
      src,
      pageNumber: index + 1,
    })
    onProgress?.({ pageNumber: index + 1, total: slides.length })
  }

  if (!result.length) {
    throw new Error('No slides found in PowerPoint file')
  }

  return result
}
