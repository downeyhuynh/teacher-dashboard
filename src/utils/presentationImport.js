import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createId } from './id'
import { slidesFromPptx } from './pptxImport'

// Legacy build includes polyfills for newer JS APIs (e.g. Map.getOrInsertComputed)
// that the modern pdfjs-dist build requires but many browsers still lack.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// Served from /public/pdfjs (copied from pdfjs-dist). Must end with "/".
const STANDARD_FONT_DATA_URL = `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`
const CMAP_URL = `${import.meta.env.BASE_URL}pdfjs/cmaps/`

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

/** Browsers often fail canvases larger than this on a side. */
const MAX_CANVAS_SIDE = 8192

/**
 * @typedef {{ id: string, source: 'pdf' | 'image' | 'whiteboard' | 'pptx', name: string, src?: string, pageNumber?: number }} Slide
 */

/**
 * Create a blank whiteboard slide for freehand teaching.
 * Uses a white SVG image so layout + ink overlays match normal slides.
 * @returns {Slide}
 */
export function createWhiteboardSlide(label = 'Whiteboard') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#ffffff"/></svg>`
  return {
    id: createId('slide'),
    source: 'whiteboard',
    name: label,
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  }
}

function fitScaleForViewport(baseViewport, preferredScale) {
  const width = baseViewport.width * preferredScale
  const height = baseViewport.height * preferredScale
  const limit = Math.max(width / MAX_CANVAS_SIDE, height / MAX_CANVAS_SIDE, 1)
  return preferredScale / limit
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), type, quality)
  })
}

async function encodeSlideCanvas(canvas) {
  // Prefer PNG for sharpness; fall back to JPEG if the browser rejects a huge PNG.
  const png = await canvasToBlob(canvas, 'image/png')
  if (png) return png

  const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.92)
  if (jpeg) return jpeg

  throw new Error('Could not encode slide image (page may be too large)')
}

/**
 * Render every page of a PDF to high-resolution slide images.
 * @returns {Promise<Slide[]>}
 */
export async function slidesFromPdf(file, { scale = 2, onProgress } = {}) {
  // Copy bytes — some environments detach the original ArrayBuffer.
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({
    data,
    // Prefer bundled standard fonts over OS fonts (more reliable across machines).
    useSystemFonts: false,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
  })
  const pdf = await loadingTask.promise
  const slides = []

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const renderScale = fitScaleForViewport(baseViewport, scale)
      const viewport = page.getViewport({ scale: renderScale })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { alpha: false })

      if (!context) {
        throw new Error('Could not create canvas for PDF page')
      }

      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      try {
        await page.render({
          canvasContext: context,
          viewport,
          canvas,
        }).promise
      } catch (error) {
        const detail = error?.message || String(error)
        throw new Error(`Could not render page ${pageNumber}: ${detail}`)
      }

      const blob = await encodeSlideCanvas(canvas)
      const src = URL.createObjectURL(blob)
      slides.push({
        id: createId('slide'),
        source: 'pdf',
        name: `${file.name} — p.${pageNumber}`,
        src,
        pageNumber,
      })

      onProgress?.({ pageNumber, total: pdf.numPages })
      page.cleanup()
    }
  } finally {
    try {
      await pdf.cleanup()
    } catch {
      // Ignore cleanup failures after a successful import.
    }
    try {
      await loadingTask.destroy()
    } catch {
      // Ignore worker teardown failures.
    }
  }

  return slides
}

/**
 * Create a slide from an image file (e.g. PowerPoint export).
 * @returns {Promise<Slide>}
 */
export async function slideFromImage(file) {
  const src = URL.createObjectURL(file)
  return {
    id: createId('slide'),
    source: 'image',
    name: file.name,
    src,
  }
}

function isPptxFile(file) {
  const name = file.name?.toLowerCase?.() || ''
  return (
    name.endsWith('.pptx') ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )
}

/**
 * Parse a FileList / File[] into slides (PPTX, PDF pages + images).
 * @returns {Promise<{ slides: Slide[], errors: string[] }>}
 */
export async function importPresentationFiles(files, { onProgress } = {}) {
  const list = Array.from(files)
  const slides = []
  const errors = []

  for (const file of list) {
    try {
      if (isPptxFile(file)) {
        const pptxSlides = await slidesFromPptx(file, {
          onProgress: (progress) =>
            onProgress?.({ fileName: file.name, ...progress }),
        })
        slides.push(...pptxSlides)
      } else if (
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf')
      ) {
        const pdfSlides = await slidesFromPdf(file, {
          onProgress: (progress) =>
            onProgress?.({ fileName: file.name, ...progress }),
        })
        slides.push(...pdfSlides)
      } else if (
        IMAGE_TYPES.has(file.type) ||
        /\.(png|jpe?g|webp|gif)$/i.test(file.name)
      ) {
        slides.push(await slideFromImage(file))
        onProgress?.({ fileName: file.name, pageNumber: 1, total: 1 })
      } else if (file.name.toLowerCase().endsWith('.ppt')) {
        errors.push(
          `Legacy .ppt is not supported. Save as .pptx or PDF: ${file.name}`,
        )
      } else {
        errors.push(`Unsupported file: ${file.name}`)
      }
    } catch (error) {
      const message = error?.message || String(error) || 'Unknown error'
      errors.push(`Failed to import ${file.name}: ${message}`)
    }
  }

  return { slides, errors }
}

/**
 * Revoke object URLs for slides to free memory.
 */
export function revokeSlideUrls(slides) {
  for (const slide of slides) {
    if (slide.src?.startsWith('blob:')) {
      URL.revokeObjectURL(slide.src)
    }
  }
}
