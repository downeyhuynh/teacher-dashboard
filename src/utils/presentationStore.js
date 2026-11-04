const DB_NAME = 'teacher-dashboard-presentations'
const DB_VERSION = 1
const META_STORE = 'meta'
const BLOB_STORE = 'blobs'
const META_KEY = 'decks-v1'

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE)
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE)
      }
    }
  })
}

function serializeSlide(slide) {
  return {
    id: slide.id,
    source: slide.source,
    name: slide.name,
    pageNumber: slide.pageNumber,
    videoId: slide.videoId,
    // Keep data URLs inline (whiteboard). Blob URLs are restored from blob store.
    src:
      typeof slide.src === 'string' && slide.src.startsWith('data:')
        ? slide.src
        : undefined,
    hasBlob: Boolean(
      typeof slide.src === 'string' &&
        (slide.src.startsWith('blob:') || slide._persistBlob),
    ),
  }
}

function serializeDeck(deck) {
  return {
    id: deck.id,
    name: deck.name,
    currentIndex: deck.currentIndex || 0,
    annotationsBySlide: deck.annotationsBySlide || {},
    slideView: deck.slideView || { scale: 1, x: 0, y: 0 },
    slides: (deck.slides || []).map(serializeSlide),
  }
}

async function blobFromSlide(slide) {
  if (slide._persistBlob instanceof Blob) return slide._persistBlob
  if (typeof slide.src === 'string' && slide.src.startsWith('blob:')) {
    const response = await fetch(slide.src)
    return response.blob()
  }
  return null
}

/**
 * Save open decks + slide image blobs so a refresh restores them.
 * @param {{ decks: object[], activeDeckId: string | null }} state
 */
export async function savePresentationState(state) {
  const decks = Array.isArray(state?.decks) ? state.decks : []
  const db = await openDb()

  try {
    const serialized = decks.map(serializeDeck)
    const blobEntries = []

    for (const deck of decks) {
      for (const slide of deck.slides || []) {
        const blob = await blobFromSlide(slide)
        if (blob) blobEntries.push([slide.id, blob])
      }
    }

    await new Promise((resolve, reject) => {
      const tx = db.transaction([META_STORE, BLOB_STORE], 'readwrite')
      const meta = tx.objectStore(META_STORE)
      const blobs = tx.objectStore(BLOB_STORE)

      // Drop blobs for slides that are gone.
      const keep = new Set(blobEntries.map(([id]) => id))
      const clearReq = blobs.openCursor()
      clearReq.onsuccess = () => {
        const cursor = clearReq.result
        if (!cursor) return
        if (!keep.has(cursor.key)) cursor.delete()
        cursor.continue()
      }

      for (const [id, blob] of blobEntries) {
        blobs.put(blob, id)
      }

      meta.put(
        {
          activeDeckId: state?.activeDeckId || null,
          decks: serialized,
          savedAt: Date.now(),
        },
        META_KEY,
      )

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/**
 * Load persisted decks and recreate object URLs for slide images.
 * @returns {Promise<{ decks: object[], activeDeckId: string | null }>}
 */
export async function loadPresentationState() {
  try {
    const db = await openDb()
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction([META_STORE, BLOB_STORE], 'readonly')
      const request = tx.objectStore(META_STORE).get(META_KEY)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })

    if (!record?.decks?.length) {
      db.close()
      return { decks: [], activeDeckId: null }
    }

    const decks = []
    for (const deck of record.decks) {
      const slides = []
      for (const slide of deck.slides || []) {
        let src = slide.src
        if (slide.hasBlob) {
          const blob = await new Promise((resolve, reject) => {
            const tx = db.transaction(BLOB_STORE, 'readonly')
            const request = tx.objectStore(BLOB_STORE).get(slide.id)
            request.onsuccess = () => resolve(request.result || null)
            request.onerror = () => reject(request.error)
          })
          if (blob) src = URL.createObjectURL(blob)
        }
        slides.push({
          id: slide.id,
          source: slide.source,
          name: slide.name,
          pageNumber: slide.pageNumber,
          videoId: slide.videoId,
          src,
        })
      }
      decks.push({
        id: deck.id,
        name: deck.name || 'Lesson',
        currentIndex: Math.min(
          Math.max(0, deck.currentIndex || 0),
          Math.max(0, slides.length - 1),
        ),
        annotationsBySlide: deck.annotationsBySlide || {},
        annotationUndoBySlide: {},
        slideView: deck.slideView || { scale: 1, x: 0, y: 0 },
        slides,
      })
    }

    db.close()

    const activeDeckId =
      decks.find((deck) => deck.id === record.activeDeckId)?.id ||
      decks[0]?.id ||
      null

    return { decks, activeDeckId }
  } catch {
    return { decks: [], activeDeckId: null }
  }
}

/** Wipe all saved presentation data. */
export async function clearPresentationState() {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction([META_STORE, BLOB_STORE], 'readwrite')
      tx.objectStore(META_STORE).clear()
      tx.objectStore(BLOB_STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Ignore quota / private mode failures.
  }
}
