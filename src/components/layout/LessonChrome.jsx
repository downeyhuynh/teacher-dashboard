import { useEffect, useMemo, useRef, useState } from 'react'
import { useTools } from '../../context/ToolsContext'
import { BathroomPanel } from '../../panels/BathroomPanel'
import { LunchRecoveryPanel } from '../../panels/LunchRecoveryPanel'
import {
  LESSON_SUBJECTS,
  getDatedSubjectContent,
  isLockedDatedDay,
} from '../../utils/lessonChrome'
import { dateKey, parseDateKey, periodsForDate } from '../../utils/lessonSchedule'

const CHROME_TABS = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'restroom', label: 'Restroom' },
  { id: 'lunch', label: 'Lunch' },
]

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function AutoGrowField({ id, value, placeholder, ariaLabel, onChange }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 40)}px`
  }, [value])

  return (
    <section className="lesson-chrome__card">
      <textarea
        ref={ref}
        id={id}
        className="lesson-chrome__input"
        rows={2}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </section>
  )
}

function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startPad; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex, day))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function ObjectiveCalendar({ datedObjectives, onSaveDay, onClose }) {
  const todayKey = dateKey(new Date())
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return { year: 2026, monthIndex: now.getFullYear() === 2026 ? now.getMonth() : 0 }
  })
  const [selectedKey, setSelectedKey] = useState(
    todayKey.startsWith('2026') ? todayKey : '2026-01-05',
  )
  const fromPlan = isLockedDatedDay(selectedKey)
  const math = getDatedSubjectContent(datedObjectives, selectedKey, 'math')
  const science = getDatedSubjectContent(datedObjectives, selectedKey, 'science')
  const [mathObjective, setMathObjective] = useState(math.objective)
  const [mathAgenda, setMathAgenda] = useState(math.agenda)
  const [scienceObjective, setScienceObjective] = useState(science.objective)
  const [scienceAgenda, setScienceAgenda] = useState(science.agenda)

  useEffect(() => {
    const nextMath = getDatedSubjectContent(datedObjectives, selectedKey, 'math')
    const nextScience = getDatedSubjectContent(datedObjectives, selectedKey, 'science')
    setMathObjective(nextMath.objective)
    setMathAgenda(nextMath.agenda)
    setScienceObjective(nextScience.objective)
    setScienceAgenda(nextScience.agenda)
  }, [datedObjectives, selectedKey])

  const cells = useMemo(
    () => buildMonthCells(month.year, month.monthIndex),
    [month.year, month.monthIndex],
  )

  const selectedDate = parseDateKey(selectedKey)
  const selectedLabel = selectedDate
    ? selectedDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : selectedKey
  const dayPeriods = selectedDate ? periodsForDate(selectedDate) : []

  const shiftMonth = (delta) => {
    setMonth((prev) => {
      const next = prev.monthIndex + delta
      if (next < 0 || next > 11) return prev
      return { year: 2026, monthIndex: next }
    })
  }

  const save = () => {
    onSaveDay(selectedKey, {
      math: { objective: mathObjective, agenda: mathAgenda },
      science: { objective: scienceObjective, agenda: scienceAgenda },
    })
  }

  return (
    <div className="lesson-chrome__calendar" role="dialog" aria-label="Math and Science calendar">
      <div className="lesson-chrome__calendar-head">
        <button type="button" className="lesson-chrome__arrow" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong>
          {MONTH_NAMES[month.monthIndex]} {month.year}
        </strong>
        <button type="button" className="lesson-chrome__arrow" onClick={() => shiftMonth(1)} aria-label="Next month">
          ›
        </button>
        <button type="button" className="stage-button lesson-chrome__calendar-close" onClick={onClose}>
          Done
        </button>
      </div>

      <div className="lesson-chrome__calendar-weekdays" aria-hidden="true">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>

      <div className="lesson-chrome__calendar-grid">
        {cells.map((date, index) => {
          if (!date) {
            return <span key={`empty-${index}`} className="lesson-chrome__calendar-cell is-empty" />
          }
          const key = dateKey(date)
          const entry = datedObjectives?.[key]
          const hasContent = Boolean(
            entry?.math?.objective ||
              entry?.math?.agenda ||
              entry?.science?.objective ||
              entry?.science?.agenda,
          )
          const isSelected = key === selectedKey
          return (
            <button
              key={key}
              type="button"
              className={`lesson-chrome__calendar-cell ${isSelected ? 'is-selected' : ''} ${
                hasContent ? 'has-content' : ''
              }`}
              onClick={() => setSelectedKey(key)}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>

      <div className="lesson-chrome__calendar-dayinfo">
        <p className="lesson-chrome__calendar-selected">{selectedLabel}</p>
        {dayPeriods.length > 0 ? (
          <ul className="lesson-chrome__calendar-periods">
            {dayPeriods.map((period) => (
              <li key={period.subject}>
                <strong>{period.label}</strong>
                <span>{period.rangeLabel}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lesson-chrome__calendar-selected">Weekend — no class schedule</p>
        )}
        {fromPlan ? (
          <p className="lesson-chrome__calendar-locked">From the Nov–Dec plan (editable)</p>
        ) : null}
      </div>

      <label className="lesson-chrome__label" htmlFor="cal-math-objective">
        Math
      </label>
      <textarea
        id="cal-math-objective"
        className="lesson-chrome__input"
        rows={2}
        value={mathObjective}
        placeholder="Math objective"
        aria-label="Math objective"
        onChange={(event) => setMathObjective(event.target.value)}
      />
      <textarea
        id="cal-math-agenda"
        className="lesson-chrome__input"
        rows={2}
        value={mathAgenda}
        placeholder="Math agenda"
        aria-label="Math agenda"
        onChange={(event) => setMathAgenda(event.target.value)}
      />

      <label className="lesson-chrome__label" htmlFor="cal-science-objective">
        Science
      </label>
      <textarea
        id="cal-science-objective"
        className="lesson-chrome__input"
        rows={2}
        value={scienceObjective}
        placeholder="Science objective"
        aria-label="Science objective"
        onChange={(event) => setScienceObjective(event.target.value)}
      />
      <textarea
        id="cal-science-agenda"
        className="lesson-chrome__input"
        rows={2}
        value={scienceAgenda}
        placeholder="Science agenda"
        aria-label="Science agenda"
        onChange={(event) => setScienceAgenda(event.target.value)}
      />

      <button type="button" className="stage-button stage-button--primary" onClick={save}>
        Save day
      </button>
    </div>
  )
}

function AgendaTab({ lesson }) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [activityTick, setActivityTick] = useState(0)
  const subjectMeta =
    LESSON_SUBJECTS.find((entry) => entry.id === lesson.subject) || LESSON_SUBJECTS[0]

  const bumpActivity = () => setActivityTick((prev) => prev + 1)

  useEffect(() => {
    if (lesson.followSchedule || showCalendar) return undefined
    const id = window.setTimeout(() => {
      lesson.followLiveSchedule()
    }, 5000)
    return () => window.clearTimeout(id)
  }, [lesson.followSchedule, lesson.followLiveSchedule, showCalendar, activityTick])

  if (showCalendar) {
    return (
      <ObjectiveCalendar
        datedObjectives={lesson.datedObjectives}
        onSaveDay={(key, dayContent) => {
          bumpActivity()
          lesson.setDatedDay(key, dayContent)
        }}
        onClose={() => {
          bumpActivity()
          setShowCalendar(false)
        }}
      />
    )
  }

  return (
    <div
      className="lesson-chrome__agenda"
      onPointerDown={bumpActivity}
      onKeyDown={bumpActivity}
    >
      {!lesson.followSchedule ? (
        <button
          type="button"
          className="stage-button lesson-chrome__follow"
          onClick={lesson.followLiveSchedule}
        >
          Follow live schedule
        </button>
      ) : null}

      <div className="lesson-chrome__center">
        <div className="lesson-chrome__switcher" role="group" aria-label="Subject">
          <button
            type="button"
            className="lesson-chrome__arrow"
            aria-label="Previous subject"
            onClick={() => {
              bumpActivity()
              lesson.prevSubject()
            }}
          >
            ‹
          </button>
          <span className="lesson-chrome__switcher-label">{subjectMeta.label}</span>
          <button
            type="button"
            className="lesson-chrome__arrow"
            aria-label="Next subject"
            onClick={() => {
              bumpActivity()
              lesson.nextSubject()
            }}
          >
            ›
          </button>
        </div>
      </div>

      <AutoGrowField
        id="lesson-objective-input"
        value={lesson.objective}
        placeholder="What will students learn?"
        ariaLabel={`${subjectMeta.label} objective`}
        onChange={(value) => {
          bumpActivity()
          lesson.setObjective(value)
        }}
      />

      <AutoGrowField
        id="lesson-agenda-input"
        value={lesson.agenda}
        placeholder="Warm-up · Lesson · Practice…"
        ariaLabel={`${subjectMeta.label} agenda`}
        onChange={(value) => {
          bumpActivity()
          lesson.setAgenda(value)
        }}
      />

      <button
        type="button"
        className="stage-button lesson-chrome__calendar-open"
        onClick={() => {
          bumpActivity()
          setShowCalendar(true)
        }}
      >
        Edit Math / Science calendar
      </button>
    </div>
  )
}

/**
 * Left sidebar: live agenda, restroom, and lunch recovery.
 * Collapses to a pull-tab so it can be brought up or taken away.
 */
export function LessonChrome() {
  const { lesson } = useTools()
  const visible = lesson.chromeVisible !== false
  const [chromeTab, setChromeTab] = useState(CHROME_TABS[0].id)

  useEffect(() => {
    if (chromeTab === 'agenda') return undefined
    const id = window.setTimeout(() => setChromeTab('agenda'), 5000)
    return () => window.clearTimeout(id)
  }, [chromeTab])

  return (
    <aside
      className={`lesson-chrome ${visible ? 'is-open' : 'is-collapsed'}`}
      aria-label="Lesson objective and agenda"
    >
      <button
        type="button"
        className="lesson-chrome__tab"
        aria-expanded={visible}
        aria-controls="lesson-chrome-panel"
        onClick={lesson.toggleChrome}
      >
        <span className="lesson-chrome__tab-label">
          {visible ? 'Hide' : 'Agenda'}
        </span>
        <span className="lesson-chrome__tab-chevron" aria-hidden="true">
          {visible ? '‹' : '›'}
        </span>
      </button>

      {visible ? (
        <div id="lesson-chrome-panel" className="lesson-chrome__body">
          <div
            className="lesson-chrome__main-tabs"
            role="tablist"
            aria-label="Agenda tools"
          >
            {CHROME_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={chromeTab === tab.id}
                className={`lesson-chrome__main-tab ${
                  chromeTab === tab.id ? 'is-active' : ''
                }`}
                onClick={() => setChromeTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {chromeTab === 'agenda' ? <AgendaTab lesson={lesson} /> : null}
          {chromeTab === 'restroom' ? (
            <div className="lesson-chrome__embed">
              <BathroomPanel />
            </div>
          ) : null}
          {chromeTab === 'lunch' ? (
            <div className="lesson-chrome__embed">
              <LunchRecoveryPanel />
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
