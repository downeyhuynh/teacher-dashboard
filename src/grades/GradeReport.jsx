import { useState } from 'react'
import {
  classLabel,
  enrolledClassIds,
  formatScore,
  subjectLabel,
  summarizeClass,
} from '../utils/gradesStore'
import { t, useLanguage } from '../utils/language'

function collectStudentWork(student, data, subject, lang) {
  const missing = []
  const tests = []
  const quizzes = []
  const classIds = enrolledClassIds(student).filter((classId) => subjectLabel(classId) === subject)
  for (const classId of classIds) {
    const classRecord = data.classes[classId]
    if (!classRecord) continue
    const summary = summarizeClass(student, classRecord)
    const label = classLabel(classId, lang)
    for (const assignment of summary.missing) {
      missing.push({ key: `${classId}-${assignment.id}`, title: assignment.title, className: label })
    }
    for (const item of summary.groups.test) {
      if (item.score.missing) continue
      tests.push({
        key: `${classId}-${item.assignment.id}`,
        title: item.assignment.title,
        className: label,
        score: formatScore(item.score, item.assignment.maxPoints),
      })
    }
    for (const item of summary.groups.quiz) {
      if (item.score.missing) continue
      quizzes.push({
        key: `${classId}-${item.assignment.id}`,
        title: item.assignment.title,
        className: label,
        score: formatScore(item.score, item.assignment.maxPoints),
      })
    }
  }
  return { missing, tests, quizzes }
}

function WorkList({ items, emptyLabel, missingLabel }) {
  if (!items.length) return <p className="grades-empty">{emptyLabel}</p>
  return (
    <ul className="grades-score-list">
      {items.map((item) => (
        <li key={item.key}>
          <span>
            {item.title}
            <em className="grades-class-tag">{item.className}</em>
          </span>
          <strong>{item.score || missingLabel}</strong>
        </li>
      ))}
    </ul>
  )
}

const SUBJECTS = ['Math', 'Science']

export function missingCounts(student, data) {
  const counts = { Math: 0, Science: 0 }
  if (!student) return { ...counts, total: 0 }
  for (const subject of SUBJECTS) {
    counts[subject] = collectStudentWork(student, data, subject).missing.length
  }
  return { ...counts, total: counts.Math + counts.Science }
}

/** Family view: missing work, quizzes, and tests, split by Math or Science. */
export function StudentProgress({ student, data }) {
  const lang = useLanguage()
  const enrolled = student ? enrolledClassIds(student) : []
  const [subject, setSubject] = useState(
    enrolled.some((classId) => subjectLabel(classId) === 'Math') ? 'Math' : 'Science',
  )
  if (!student) return null
  const counts = missingCounts(student, data)
  const work = collectStudentWork(student, data, subject, lang)
  const none = t(lang, 'none')
  const missingMark = t(lang, 'missingMark')
  return (
    <section className="grade-report" aria-label={`${student.name} progress`}>
      <div className="grades-classes" role="tablist" aria-label={t(lang, 'subject')}>
        {SUBJECTS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={subject === name}
            className={`tool-chip ${subject === name ? 'is-active' : ''}`}
            onClick={() => setSubject(name)}
          >
            {t(lang, name === 'Math' ? 'math' : 'science')}
            <span className="missing-count">{counts[name]}</span>
          </button>
        ))}
      </div>
      <div className="grade-report__block">
        <h4>
          {t(lang, 'missingWork')}
          <span className="missing-count">{work.missing.length}</span>
        </h4>
        <WorkList items={work.missing} emptyLabel={none} missingLabel={missingMark} />
      </div>
      <div className="grade-report__block">
        <h4>{t(lang, 'tests')}</h4>
        <WorkList items={work.tests} emptyLabel={none} missingLabel={missingMark} />
      </div>
      <div className="grade-report__block">
        <h4>{t(lang, 'quizzes')}</h4>
        <WorkList items={work.quizzes} emptyLabel={none} missingLabel={missingMark} />
      </div>
    </section>
  )
}
