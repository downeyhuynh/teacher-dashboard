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

async function waitForAudioDuration(audio) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    return audio.duration
  }

  return new Promise((resolve) => {
    const finish = () => {
      audio.removeEventListener('loadedmetadata', finish)
      audio.removeEventListener('error', finish)
      resolve(
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : 0,
      )
    }
    audio.addEventListener('loadedmetadata', finish)
    audio.addEventListener('error', finish)
    // Nudge load in case metadata was not requested yet.
    try {
      audio.load()
    } catch {
      // ignore
    }
  })
}

function pickRandomStartSeconds(duration) {
  if (!Number.isFinite(duration) || duration <= 2) return 0
  // Stay off the very end so looping feels natural.
  return Math.random() * Math.max(0, duration - 1)
}

async function startCustomAudio(url, { volume = 0.45 } = {}) {
  stopFocusJazz()
  stopCustomAudio()

  const audio = new Audio(url)
  audio.loop = true
  audio.preload = 'metadata'
  audio.volume = volume
  customAudio = audio

  const duration = await waitForAudioDuration(audio)
  const startAt = pickRandomStartSeconds(duration)
  if (startAt > 0) {
    try {
      await new Promise((resolve) => {
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          audio.removeEventListener('seeked', done)
          window.clearTimeout(timeoutId)
          resolve()
        }
        const timeoutId = window.setTimeout(done, 400)
        audio.addEventListener('seeked', done)
        audio.currentTime = startAt
      })
    } catch {
      // Some browsers reject seek before fully ready; play from start.
    }
  }

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
