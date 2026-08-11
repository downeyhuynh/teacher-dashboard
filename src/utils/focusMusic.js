import { startFocusJazz, stopFocusJazz } from './focusJazz'

const DB_NAME = 'teacher-dashboard-focus-audio'
const DB_STORE = 'tracks'
const DB_KEY = 'focus-track'

let customAudio = null
let customObjectUrl = null
let startToken = 0

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
    customAudio.removeAttribute('src')
    customAudio.load()
  } catch {
    // ignore
  }
  customAudio = null
}

function hasValidDuration(audio) {
  return Number.isFinite(audio.duration) && audio.duration > 0
}

async function waitForAudioDuration(audio) {
  if (hasValidDuration(audio)) return audio.duration

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      resolve(hasValidDuration(audio) ? audio.duration : 0)
    }, 4000)

    const finish = () => {
      if (!hasValidDuration(audio)) return
      cleanup()
      resolve(audio.duration)
    }

    const onError = () => {
      cleanup()
      resolve(0)
    }

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      audio.removeEventListener('loadedmetadata', finish)
      audio.removeEventListener('durationchange', finish)
      audio.removeEventListener('canplay', finish)
      audio.removeEventListener('error', onError)
    }

    audio.addEventListener('loadedmetadata', finish)
    audio.addEventListener('durationchange', finish)
    audio.addEventListener('canplay', finish)
    audio.addEventListener('error', onError)

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

async function seekTo(audio, seconds) {
  if (!(seconds > 0)) return

  await new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      audio.removeEventListener('seeked', done)
      window.clearTimeout(timeoutId)
      resolve()
    }
    const timeoutId = window.setTimeout(done, 600)
    audio.addEventListener('seeked', done)
    try {
      audio.currentTime = seconds
    } catch {
      done()
    }
  })
}

async function startCustomAudio(url, { volume = 0.45, token } = {}) {
  stopFocusJazz()
  stopCustomAudio()

  const audio = new Audio()
  audio.preload = 'auto'
  audio.loop = true
  audio.volume = volume
  audio.src = url
  customAudio = audio

  const duration = await waitForAudioDuration(audio)
  if (token !== startToken || customAudio !== audio) return

  const startAt = pickRandomStartSeconds(duration)

  // Seek before play when possible; some browsers need play first.
  await seekTo(audio, startAt)
  if (token !== startToken || customAudio !== audio) return

  await audio.play()
  if (token !== startToken || customAudio !== audio) {
    try {
      audio.pause()
    } catch {
      // ignore
    }
    return
  }

  // If duration arrived late (common for long MP3s), re-roll once after play.
  if (startAt <= 0 && hasValidDuration(audio)) {
    await seekTo(audio, pickRandomStartSeconds(audio.duration))
  }
}

/**
 * Start focus music: uploaded MP3 if available, otherwise soft jazz.
 * Always restarts from a fresh random position.
 */
export async function startFocusMusic({ trackUrl = null } = {}) {
  const token = ++startToken

  // Always tear down first so every timer Start gets a new random spot.
  stopCustomAudio()
  stopFocusJazz()

  if (trackUrl) {
    await startCustomAudio(trackUrl, { token })
    return { source: 'upload' }
  }

  if (token !== startToken) return { source: 'jazz' }
  await startFocusJazz()
  return { source: 'jazz' }
}

/**
 * Stop whichever focus music source is active.
 */
export function stopFocusMusic() {
  startToken += 1
  stopCustomAudio()
  stopFocusJazz()
}
