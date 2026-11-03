import { useEffect, useMemo, useRef, useState } from 'react'
import { useTools } from '../../context/ToolsContext'
import { BathroomPanel } from '../../panels/BathroomPanel'
import { LunchRecoveryPanel } from '../../panels/LunchRecoveryPanel'
import {
  LESSON_SUBJECTS,
  getDatedSubjectContent,
  isLockedDatedDay,
} from '../../utils/lessonChrome'
import { dateKey, parseDateKey } from '../../utils/lessonSchedule'

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

function AutoGrowField({
  id,
  label,
  value,
  placeholder,
  ariaLabel,
  onChange,
  readOnly = false,
}) {
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
        readOnly={readOnly}
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
  const locked = isLockedDatedDay(selectedKey)
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
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : selectedKey

  const shiftMonth = (delta) => {
    setMonth((prev) => {
      const next = prev.monthIndex + delta
      if (next < 0 || next > 11) return prev
      return { year: 2026, monthIndex: next }
    })
  }

  const save = () => {
    if (locked) return
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

      {locked ? (
        <p className="lesson-chrome__calendar-locked">Locked from the Nov–Dec plan</p>
      ) : null}

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

      <p className="lesson-chrome__calendar-selected">{selectedLabel}</p>

      <label className="lesson-chrome__label" htmlFor="cal-math-objective">
        Math objective
      </label>
      <textarea
        id="cal-math-objective"
        className="lesson-chrome__input"
        rows={2}
        value={mathObjective}
        readOnly={locked}
        onChange={(event) => setMathObjective(event.target.value)}
      />
      <label className="lesson-chrome__label" htmlFor="cal-math-agenda">
        Math agenda
      </label>
      <textarea
        id="cal-math-agenda"
        className="lesson-chrome__input"
        rows={2}
        value={mathAgenda}
        readOnly={locked}
        onChange={(event) => setMathAgenda(event.target.value)}
      />

      <label className="lesson-chrome__label" htmlFor="cal-science-objective">
        Science objective
      </label>
      <textarea
        id="cal-science-objective"
        className="lesson-chrome__input"
        rows={2}
        value={scienceObjective}
        readOnly={locked}
        onChange={(event) => setScienceObjective(event.target.value)}
      />
      <label className="lesson-chrome__label" htmlFor="cal-science-agenda">
        Science agenda
      </label>
      <textarea
        id="cal-science-agenda"
        className="lesson-chrome__input"
        rows={2}
        value={scienceAgenda}
        readOnly={locked}
        onChange={(event) => setScienceAgenda(event.target.value)}
      />

      {!locked ? (
        <button type="button" className="stage-button stage-button--primary" onClick={save}>
          Save day
        </button>
      ) : null}
    </div>
  )
}

function AgendaTab({ lesson }) {
  const [showCalendar, setShowCalendar] = useState(false)
  const subjectMeta =
    LESSON_SUBJECTS.find((entry) => entry.id === lesson.subject) || LESSON_SUBJECTS[0]
  const readOnly = !lesson.editable
  const periodLabel = lesson.period
    ? `${lesson.period.label} · ${lesson.period.rangeLabel}`
    : lesson.nextPeriod
      ? `Between classes · next ${lesson.nextPeriod.label} (${lesson.nextPeriod.rangeLabel})`
      : 'Outside class schedule'
  const dateLabel = lesson.dateLabel || ''

  if (showCalendar) {
    return (
      <ObjectiveCalendar
        datedObjectives={lesson.datedObjectives}
        onSaveDay={lesson.setDatedDay}
        onClose={() => setShowCalendar(false)}
      />
    )
  }

  return (
    <>
      <div className="lesson-chrome__period" aria-live="polite">
        {dateLabel ? <span className="lesson-chrome__period-date">{dateLabel}</span> : null}
        <strong>{periodLabel}</strong>
        <span>{subjectMeta.label}</span>
      </div>

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
      </div>

      <AutoGrowField
        id="lesson-objective-input"
        label="Lesson objective:"
        value={lesson.objective}
        placeholder={
          lesson.betweenClasses
            ? 'No active period right now'
            : 'What will students learn?'
        }
        ariaLabel={`${subjectMeta.label} lesson objective`}
        onChange={lesson.setObjective}
        readOnly={readOnly}
      />

      <AutoGrowField
        id="lesson-agenda-input"
        label="Agenda:"
        value={lesson.agenda}
        placeholder={
          lesson.betweenClasses ? 'Waiting for the next period' : 'Warm-up · Lesson · Practice…'
        }
        ariaLabel={`${subjectMeta.label} agenda`}
        onChange={lesson.setAgenda}
        readOnly={readOnly}
      />

      <button
        type="button"
        className="stage-button lesson-chrome__calendar-open"
        onClick={() => setShowCalendar(true)}
      >
        Edit Math / Science calendar
      </button>
    </>
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
