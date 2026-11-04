import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  { id: 'calendar', label: 'Calendar' },
  { id: 'restroom', label: 'Restroom' },
  { id: 'lunch', label: 'Lunch' },
]

const IDLE_RETURN_MS = 5000

/** Run `onIdle` after idleMs with no activity, only while the page is visible. */
function useIdleTimeout(enabled, onIdle, activityTick, idleMs = IDLE_RETURN_MS) {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!enabled) return undefined

    let id = 0
    const clear = () => {
      if (id) window.clearTimeout(id)
      id = 0
    }
    const arm = () => {
      clear()
      if (document.visibilityState !== 'visible') return
      id = window.setTimeout(() => onIdleRef.current?.(), idleMs)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') arm()
      else clear()
    }

    arm()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clear()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, activityTick, idleMs])
}

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

function supportsFieldSizing() {
  return typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content')
}

function resizeTextArea(el) {
  if (!el) return
  // Skip while not laid out (e.g. parent [hidden]) — caller should remeasure later.
  if (el.getClientRects().length === 0) return
  if (supportsFieldSizing()) {
    // Let CSS grow the field; clear any stale inline height from earlier measures.
    el.style.height = ''
    return
  }
  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight, 40)}px`
}

function AutoGrowField({ id, label, value, placeholder, ariaLabel, onChange, remountKey }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    resizeTextArea(ref.current)
  }, [value, remountKey])

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const onResize = () => resizeTextArea(el)
    window.addEventListener('resize', onResize)

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => resizeTextArea(el))
      : null
    observer?.observe(el)

    // Catch fonts / late layout after first paint.
    const raf = window.requestAnimationFrame(() => resizeTextArea(el))

    return () => {
      window.removeEventListener('resize', onResize)
      observer?.disconnect()
      window.cancelAnimationFrame(raf)
    }
  }, [remountKey])

  return (
    <section className="lesson-chrome__card lesson-chrome__card--grow">
      {label ? (
        <label className="lesson-chrome__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={id}
        className="lesson-chrome__input"
        rows={1}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel || label}
        onChange={(event) => {
          resizeTextArea(event.currentTarget)
          onChange?.(event.target.value)
        }}
        onInput={(event) => resizeTextArea(event.currentTarget)}
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

function ObjectiveCalendar({ datedObjectives, onSaveDay }) {
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
    <div className="lesson-chrome__calendar" aria-label="Math and Science calendar">
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
          const isToday = key === todayKey
          return (
            <button
              key={key}
              type="button"
              className={`lesson-chrome__calendar-cell ${isSelected ? 'is-selected' : ''} ${
                hasContent ? 'has-content' : ''
              } ${isToday ? 'is-today' : ''}`}
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

/** Subject switcher + Lesson/Agenda — shown on Agenda, Restroom, and Lunch. */
function LessonAgendaBlock({ lesson, active, activityTick, onActivity }) {
  const subjectMeta =
    LESSON_SUBJECTS.find((entry) => entry.id === lesson.subject) || LESSON_SUBJECTS[0]

  useIdleTimeout(
    Boolean(active && !lesson.followSchedule),
    lesson.followLiveSchedule,
    activityTick,
  )

  return (
    <div className="lesson-chrome__agenda" hidden={!active}>
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
              onActivity?.()
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
              onActivity?.()
              lesson.nextSubject()
            }}
          >
            ›
          </button>
        </div>
      </div>

      <AutoGrowField
        id="lesson-objective-input"
        label="Lesson"
        value={lesson.objective}
        placeholder="What will students learn?"
        ariaLabel={`${subjectMeta.label} lesson`}
        remountKey={active ? 'shown' : 'hidden'}
        onChange={(value) => {
          onActivity?.()
          lesson.setObjective(value)
        }}
      />

      <AutoGrowField
        id="lesson-agenda-input"
        label="Agenda"
        value={lesson.agenda}
        placeholder="Warm-up · Lesson · Practice…"
        ariaLabel={`${subjectMeta.label} agenda`}
        remountKey={active ? 'shown' : 'hidden'}
        onChange={(value) => {
          onActivity?.()
          lesson.setAgenda(value)
        }}
      />
    </div>
  )
}

/**
 * Left sidebar: live agenda, calendar, restroom, and lunch recovery.
 * Collapses to a pull-tab so it can be brought up or taken away.
 */
export function LessonChrome() {
  const { lesson } = useTools()
  const visible = lesson.chromeVisible !== false
  const [chromeTab, setChromeTab] = useState(CHROME_TABS[0].id)
  const [activityTick, setActivityTick] = useState(0)

  const bumpActivity = () => setActivityTick((prev) => prev + 1)
  const showLessonAgenda =
    chromeTab === 'agenda' || chromeTab === 'restroom' || chromeTab === 'lunch'

  useIdleTimeout(
    chromeTab !== 'agenda',
    () => setChromeTab('agenda'),
    activityTick,
  )

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
        <div
          id="lesson-chrome-panel"
          className="lesson-chrome__body"
          onPointerDown={bumpActivity}
          onKeyDown={bumpActivity}
        >
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
                onClick={() => {
                  bumpActivity()
                  setChromeTab(tab.id)
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Lesson/Agenda stay up on Restroom and Lunch; Calendar replaces them. */}
          <LessonAgendaBlock
            lesson={lesson}
            active={showLessonAgenda}
            activityTick={activityTick}
            onActivity={bumpActivity}
          />

          <div
            className="lesson-chrome__panel"
            hidden={chromeTab !== 'calendar'}
          >
            <ObjectiveCalendar
              datedObjectives={lesson.datedObjectives}
              onSaveDay={lesson.setDatedDay}
            />
          </div>
          <div
            className="lesson-chrome__embed"
            hidden={chromeTab !== 'restroom'}
          >
            <BathroomPanel />
          </div>
          <div className="lesson-chrome__embed" hidden={chromeTab !== 'lunch'}>
            <LunchRecoveryPanel />
          </div>
        </div>
      ) : null}
    </aside>
  )
}
