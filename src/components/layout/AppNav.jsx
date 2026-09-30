import { navigateApp } from '../../utils/appView'

export function AppNav() {
  return (
    <nav className="app-nav" aria-label="Main">
      <button type="button" className="app-nav__link" onClick={() => navigateApp('home')}>
        Home
      </button>
    </nav>
  )
}
