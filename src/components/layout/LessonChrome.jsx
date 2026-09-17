import { useTools } from '../../context/ToolsContext'
import { LESSON_SUBJECTS } from '../../utils/lessonChrome'

/**
 * Persistent top chrome: lesson objective (left) and today's agenda (right).
 * Two-line cards for visibility; left/right switches Math ↔ Science.
 */
export function LessonChrome() {
  const { lesson } = useTools()
  const subjectMeta =
    LESSON_SUBJECTS.find((entry) => entry.id === lesson.subject) ||
    LESSON_SUBJECTS[0]

  return (
    <div className="lesson-chrome" aria-label="Lesson objective and agenda">
      <section className="lesson-chrome__card lesson-chrome__card--objective">
        <label className="lesson-chrome__label" htmlFor="lesson-objective-input">
          Lesson objective:
        </label>
        <textarea
          id="lesson-objective-input"
          className="lesson-chrome__input"
          rows={2}
          value={lesson.objective}
          placeholder="What will students learn?"
          aria-label={`${subjectMeta.label} lesson objective`}
          onChange={(event) => lesson.setObjective(event.target.value)}
        />
      </section>

      <div className="lesson-chrome__switcher" role="group" aria-label="Subject">
        <button
          type="button"
          className="lesson-chrome__arrow"
          aria-label="Previous subject"
          onClick={lesson.prevSubject}
        >
          ‹
        </button>
        <span className="lesson-chrome__switcher-label">{subjectMeta.label}</span>
        <button
          type="button"
          className="lesson-chrome__arrow"
          aria-label="Next subject"
          onClick={lesson.nextSubject}
        >
          ›
        </button>
      </div>

      <section className="lesson-chrome__card lesson-chrome__card--agenda">
        <label className="lesson-chrome__label" htmlFor="lesson-agenda-input">
          Today&apos;s agenda:
        </label>
        <textarea
          id="lesson-agenda-input"
          className="lesson-chrome__input"
          rows={2}
          value={lesson.agenda}
          placeholder="Warm-up · Lesson · Practice…"
          aria-label={`${subjectMeta.label} today's agenda`}
          onChange={(event) => lesson.setAgenda(event.target.value)}
        />
      </section>
    </div>
  )
}
