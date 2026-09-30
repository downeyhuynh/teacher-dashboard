import { navigateApp } from '../../utils/appView'

const CHOICES = [
  {
    id: 'dashboard',
    label: 'Teacher Dashboard',
    detail: 'Slides, timers, agenda, and classroom tools',
  },
  {
    id: 'portal',
    label: 'Progress Report',
    detail: 'Family view of a student’s grades',
  },
]

export function HomeScreen() {
  return (
    <div className="home-screen">
      <div className="home-screen__panel">
        <p className="grades-kicker">Choose where to go</p>
        <h1>Teacher Dashboard</h1>
        <div className="home-choices">
          {CHOICES.map((choice) => (
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
