import { navigateApp } from '../../utils/appView'
import { t, useLanguage } from '../../utils/language'

export function AppNav() {
  const lang = useLanguage()
  return (
    <nav className="app-nav" aria-label="Main">
      <button type="button" className="app-nav__link" onClick={() => navigateApp('home')}>
        {t(lang, 'home')}
      </button>
    </nav>
  )
}
