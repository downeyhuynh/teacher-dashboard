import { startFocusJazz, stopFocusJazz } from './focusJazz'

const DB_NAME = 'teacher-dashboard-focus-audio'
const DB_STORE = 'tracks'
const DB_KEY = 'focus-track'

let customAudio = null
let customObjectUrl = null

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE)
      }
    }
  })
}

/**
 * Load previously uploaded focus track from IndexedDB.
 * @returns {Promise<{ name: string, url: string } | null>}
 */
export async function loadStoredFocusTrack() {
  try {
    const db = await openDb()
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly')
      const store = tx.objectStore(DB_STORE)
      const request = store.get(DB_KEY)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
    db.close()

    if (!record?.blob) return null

    if (customObjectUrl) {
      URL.revokeObjectURL(customObjectUrl)
    }
    customObjectUrl = URL.createObjectURL(record.blob)
    return {
      name: record.name || 'Uploaded track',
      url: customObjectUrl,
    }
  } catch {
    return null
  }
}

/**
 * Persist an uploaded audio file for timer focus music.
 * @returns {Promise<{ name: string, url: string }>}
 */
export async function saveFocusTrack(file) {
  if (!file) {
    throw new Error('No audio file selected')
  }

  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    const store = tx.objectStore(DB_STORE)
    store.put(
      {
        name: file.name,
        type: file.type || 'audio/mpeg',
        blob: file,
        savedAt: Date.now(),
      },
      DB_KEY,
    )
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()

  if (customObjectUrl) {
    URL.revokeObjectURL(customObjectUrl)
  }
  customObjectUrl = URL.createObjectURL(file)

  return {
    name: file.name,
    url: customObjectUrl,
  }
}

/**
 * Remove uploaded focus track.
 */
export async function clearFocusTrack() {
  stopCustomAudio()

  if (customObjectUrl) {
    URL.revokeObjectURL(customObjectUrl)
    customObjectUrl = null
  }

  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).delete(DB_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Ignore storage cleanup failures.
  }
}

function stopCustomAudio() {
  if (!customAudio) return
  try {
    customAudio.pause()
    customAudio.currentTime = 0
    customAudio.src = ''
  } catch {
    // ignore
  }
  customAudio = null
}

async function startCustomAudio(url, { volume = 0.45 } = {}) {
  stopFocusJazz()
  stopCustomAudio()

  const audio = new Audio(url)
  audio.loop = true
  audio.volume = volume
  customAudio = audio
  await audio.play()
}

/**
 * Start focus music: uploaded MP3 if available, otherwise soft jazz.
 */
export async function startFocusMusic({ trackUrl = null } = {}) {
  if (trackUrl) {
    await startCustomAudio(trackUrl)
    return { source: 'upload' }
  }

  stopCustomAudio()
  await startFocusJazz()
  return { source: 'jazz' }
}

/**
 * Stop whichever focus music source is active.
 */
export function stopFocusMusic() {
  stopCustomAudio()
  stopFocusJazz()
}
