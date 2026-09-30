import { useEffect, useState } from 'react'

/** Hash routes keep GitHub Pages working without a server rewrite. */
export function viewFromHash() {
  const raw = (window.location.hash || '').replace(/^#/, '') || '/'
  const path = raw.split('?')[0]
  if (path === '/portal' || path === '/progress' || path.startsWith('/portal/') || path.startsWith('/progress/')) {
    return 'portal'
  }
  if (path === '/dashboard' || path.startsWith('/dashboard/')) return 'dashboard'
  return 'home'
}

const HASH_FOR_VIEW = {
  home: '#/',
  dashboard: '#/dashboard',
  portal: '#/portal',
}

export function navigateApp(view) {
  const next = HASH_FOR_VIEW[view] || '#/'
  const current = window.location.hash
  if (current === next) return
  if (view === 'home' && (current === '' || current === '#')) return
  window.location.hash = next
}

export function useAppView() {
  const [view, setView] = useState(viewFromHash)

  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (view === 'portal') document.title = 'Progress Report'
    else if (view === 'dashboard') document.title = 'Teacher Dashboard'
    else document.title = 'Teacher Dashboard'
  }, [view])

  return view
}
