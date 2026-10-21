/** Pull an 11-character YouTube id out of a pasted link. */
export function youtubeVideoId(input) {
  const text = String(input || '').trim()
  if (!text) return ''

  const isId = (value) => /^[A-Za-z0-9_-]{11}$/.test(value || '')
  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`

  let url
  try {
    url = new URL(withProtocol)
  } catch {
    return ''
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return isId(id) ? id : ''
  }

  const youtubeHost =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  if (!youtubeHost) return ''

  const fromQuery = url.searchParams.get('v')
  if (isId(fromQuery)) return fromQuery

  const parts = url.pathname.split('/').filter(Boolean)
  const marker = parts.findIndex((part) => ['embed', 'shorts', 'live', 'v'].includes(part))
  if (marker >= 0 && isId(parts[marker + 1])) return parts[marker + 1]
  return ''
}
