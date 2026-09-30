import { navigateApp } from '../../utils/appView'
import { setLanguage, t, useLanguage } from '../../utils/language'

export function HomeScreen() {
  const lang = useLanguage()
  const choices = [
    {
      id: 'dashboard',
      label: t(lang, 'dashboardLabel'),
      detail: t(lang, 'dashboardDetail'),
    },
    {
      id: 'portal',
      label: t(lang, 'portalLabel'),
      detail: t(lang, 'portalDetail'),
    },
  ]

  return (
    <div className="home-screen">
      <div className="home-screen__panel">
        <div className="language-toggle" role="group" aria-label={t(lang, 'language')}>
          <button
            type="button"
            aria-pressed={lang === 'en'}
            className={lang === 'en' ? 'is-active' : ''}
            onClick={() => setLanguage('en')}
          >
            English
          </button>
          <button
            type="button"
            aria-pressed={lang === 'es'}
            className={lang === 'es' ? 'is-active' : ''}
            onClick={() => setLanguage('es')}
          >
            Español
          </button>
        </div>
        <p className="grades-kicker">{t(lang, 'homeKicker')}</p>
        <h1>{t(lang, 'homeTitle')}</h1>
        <div className="home-choices">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className="home-choice"
              onClick={() => navigateApp(choice.id)}
            >
              <strong>{choice.label}</strong>
              <span>{choice.detail}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
