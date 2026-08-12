import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createId } from './id'
import { slidesFromPptx } from './pptxImport'

// Legacy build includes polyfills for newer JS APIs (e.g. Map.getOrInsertComputed)
// that the modern pdfjs-dist build requires but many browsers still lack.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

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

/**
 * Render every page of a PDF to high-resolution PNG slide images.
 * @returns {Promise<Slide[]>}
 */
export async function slidesFromPdf(file, { scale = 2.5, onProgress } = {}) {
  const data = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
  })
  const pdf = await loadingTask.promise
  const slides = []

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { alpha: false })

      if (!context) {
        throw new Error('Could not create canvas for PDF page')
      }

      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({
        canvasContext: context,
        viewport,
        canvas,
      }).promise

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result)
            else reject(new Error('Failed to encode PDF page image'))
          },
          'image/png',
        )
      })

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
