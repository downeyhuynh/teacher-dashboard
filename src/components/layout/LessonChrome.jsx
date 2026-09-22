import { useEffect, useRef } from 'react'
import { useTools } from '../../context/ToolsContext'
import { LESSON_DAYS, LESSON_SUBJECTS } from '../../utils/lessonChrome'

function AutoGrowField({ id, label, value, placeholder, ariaLabel, onChange }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 40)}px`
  }, [value])

  return (
    <section className="lesson-chrome__card">
      <label className="lesson-chrome__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        className="lesson-chrome__input"
        rows={2}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  )
}

/**
 * Persistent top chrome: lesson objective (left) and agenda (right).
 * Cycle subjects; Mon–Thu day tabs for work-ahead plans.
 */
export function LessonChrome() {
  const { lesson } = useTools()
  const rootRef = useRef(null)
  const subjectMeta =
    LESSON_SUBJECTS.find((entry) => entry.id === lesson.subject) ||
    LESSON_SUBJECTS[0]
  const dayMeta =
    LESSON_DAYS.find((entry) => entry.id === lesson.day) || LESSON_DAYS[0]

  useEffect(() => {
    const el = rootRef.current
    const surface = el?.closest('.presentation-stage__surface')
    if (!el || !surface || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const syncHeight = () => {
      surface.style.setProperty('--lesson-chrome-height', `${el.offsetHeight}px`)
    }

    syncHeight()
    const observer = new ResizeObserver(syncHeight)
    observer.observe(el)
    return () => {
      observer.disconnect()
      surface.style.removeProperty('--lesson-chrome-height')
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="lesson-chrome"
      aria-label="Lesson objective and agenda"
    >
      <AutoGrowField
        id="lesson-objective-input"
        label="Lesson objective:"
        value={lesson.objective}
        placeholder="What will students learn?"
        ariaLabel={`${subjectMeta.label} ${dayMeta.label} lesson objective`}
        onChange={lesson.setObjective}
      />

      <div className="lesson-chrome__center">
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

        <div
          className="lesson-chrome__days"
          role="tablist"
          aria-label="Plan day"
        >
          {LESSON_DAYS.map((day) => {
            const active = day.id === lesson.day
            return (
              <button
                key={day.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={
                  active
                    ? 'lesson-chrome__day is-active'
                    : 'lesson-chrome__day'
                }
                onClick={() => lesson.setDay(day.id)}
              >
                {day.shortLabel}
              </button>
            )
          })}
        </div>
      </div>

      <AutoGrowField
        id="lesson-agenda-input"
        label={`${dayMeta.label}'s agenda:`}
        value={lesson.agenda}
        placeholder="Warm-up · Lesson · Practice…"
        ariaLabel={`${subjectMeta.label} ${dayMeta.label} agenda`}
        onChange={lesson.setAgenda}
      />
    </div>
  )
}
