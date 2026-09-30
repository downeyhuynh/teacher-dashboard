import { useEffect, useMemo, useState } from 'react'
import { missingCounts, StudentProgress } from '../grades/GradeReport'
import { useGrades } from '../hooks/useGrades'
import { navigateApp } from '../utils/appView'
import { t, useLanguage } from '../utils/language'
import {
  clearPortalSession,
  formatUpdated,
  pinMatches,
  readPortalSession,
  searchStudents,
  writePortalSession,
} from '../utils/gradesStore'

const FAIL_KEY = 'teacher-dashboard.portal-fails'
const FAIL_LIMIT = 5
const LOCK_MS = 30_000

function readLock() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(FAIL_KEY) || '')
    if (!parsed?.until || parsed.until < Date.now()) return { count: parsed?.count || 0, until: 0 }
    return parsed
  } catch {
    return { count: 0, until: 0 }
  }
}

export function ParentPortal() {
  const data = useGrades()
  const [sessionId, setSessionId] = useState(readPortalSession)
  const student = data.students.find((item) => item.id === sessionId) || null

  useEffect(() => {
    if (sessionId && !student) {
      clearPortalSession()
      setSessionId(null)
    }
  }, [sessionId, student])

  if (student) {
    return (
      <PortalDashboard
        data={data}
        student={student}
        onSignOut={() => {
          clearPortalSession()
          setSessionId(null)
        }}
      />
    )
  }

  return <PortalGate data={data} onGranted={setSessionId} />
}

function PortalGate({ data, onGranted }) {
  const lang = useLanguage()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [pin, setPin] = useState('')
  const [errorKey, setErrorKey] = useState('')
  const [lockedUntil, setLockedUntil] = useState(() => readLock().until)
  const matches = useMemo(() => searchStudents(data, query), [data, query])
  const selected = data.students.find((student) => student.id === selectedId) || null

  const submit = async (event) => {
    event.preventDefault()
    setErrorKey('')
    if (lockedUntil > Date.now()) {
      setErrorKey('tooMany')
      return
    }
    if (!selected) {
      setErrorKey('chooseName')
      return
    }
    const ok = await pinMatches(selected, pin)
    if (!ok) {
      const prior = readLock()
      const count = (prior.until > Date.now() ? prior.count : prior.count) + 1
      const until = count >= FAIL_LIMIT ? Date.now() + LOCK_MS : 0
      const nextCount = until ? 0 : count
      sessionStorage.setItem(FAIL_KEY, JSON.stringify({ count: nextCount, until }))
      setLockedUntil(until)
      setErrorKey(until ? 'tooMany' : 'codeMismatch')
      return
    }
    sessionStorage.removeItem(FAIL_KEY)
    writePortalSession(selected.id)
    onGranted(selected.id)
  }

  return (
    <div className="portal-page">
      <button type="button" className="home-link" onClick={() => navigateApp('home')}>
        {t(lang, 'home')}
      </button>
      <form className="portal-card" onSubmit={submit}>
        <p className="grades-kicker">{t(lang, 'familyAccess')}</p>
        <h1>{t(lang, 'progressReport')}</h1>
        <p className="grades-help">{t(lang, 'portalHelp')}</p>
        <label className="grades-label" htmlFor="portal-search">
          {t(lang, 'searchStudent')}
        </label>
        <input
          id="portal-search"
          className="grades-input"
          value={query}
          placeholder={t(lang, 'searchPlaceholder')}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedId(null)
            setErrorKey('')
          }}
        />
        {query.trim() ? (
          <ul className="portal-matches" role="listbox" aria-label={t(lang, 'matchingStudents')}>
            {matches.length ? (
              matches.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedId === student.id}
                    className={`grades-student ${selectedId === student.id ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedId(student.id)
                      setQuery(student.name)
                      setErrorKey('')
                    }}
                  >
                    <span>{student.name}</span>
                  </button>
                </li>
              ))
            ) : (
              <li className="grades-empty">{t(lang, 'noMatches')}</li>
            )}
          </ul>
        ) : null}
        <label className="grades-label" htmlFor="portal-pin">
          {t(lang, 'accessCode')}
        </label>
        <input
          id="portal-pin"
          className="grades-input pin-code"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="______"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        {errorKey ? <p className="grades-error">{t(lang, errorKey)}</p> : null}
        <button type="submit" className="stage-button stage-button--primary portal-submit">
          {t(lang, 'viewProgress')}
        </button>
      </form>
    </div>
  )
}

function PortalDashboard({ data, student, onSignOut }) {
  const lang = useLanguage()
  const missing = missingCounts(student, data)
  return (
    <div className="portal-page">
      <button type="button" className="home-link" onClick={() => navigateApp('home')}>
        {t(lang, 'home')}
      </button>
      <div className="portal-card portal-card--wide">
        <div className="grades-card__toolbar">
          <div>
            <p className="grades-kicker">{t(lang, 'progressReport')}</p>
            <h1>{student.name}</h1>
            <p className="missing-total">
              {t(lang, 'totalMissing')} <strong>{missing.total}</strong>
            </p>
          </div>
          <button type="button" className="stage-button" onClick={onSignOut}>
            {t(lang, 'signOut')}
          </button>
        </div>
        <p className="grades-help">
          {t(lang, 'lastUpdated')} {formatUpdated(data.lastUpdated, lang)}
        </p>
        <StudentProgress student={student} data={data} />
      </div>
    </div>
  )
}
