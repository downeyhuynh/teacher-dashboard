import { useState } from 'react'
import { MarksReport } from './MarksReport'
import {
  classLabel,
  enrolledClassIds,
  subjectLabel,
  summarizeClass,
} from '../utils/gradesStore'
import { t, useLanguage } from '../utils/language'

function collectStudentWork(student, data, subject, lang) {
  const missing = []
  const classIds = enrolledClassIds(student).filter((classId) => subjectLabel(classId) === subject)
  for (const classId of classIds) {
    const classRecord = data.classes[classId]
    if (!classRecord) continue
    const summary = summarizeClass(student, classRecord)
    const label = classLabel(classId, lang)
    for (const assignment of summary.missing) {
      if (assignment.category === 'quiz' || assignment.category === 'test') continue
      missing.push({ key: `${classId}-${assignment.id}`, title: assignment.title, className: label })
    }
  }
  return { missing }
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

function HomeworkProgress({ student, data }) {
  const lang = useLanguage()
  const enrolled = enrolledClassIds(student)
  const [subject, setSubject] = useState(
    enrolled.some((classId) => subjectLabel(classId) === 'Math') ? 'Math' : 'Science',
  )
  const counts = missingCounts(student, data)
  const work = collectStudentWork(student, data, subject, lang)
  const none = t(lang, 'none')
  const missingMark = t(lang, 'missingMark')
  return (
    <>
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
    </>
  )
}

/** Family view: homework stays separate from category progress-report marks. */
export function StudentProgress({ student, data }) {
  const lang = useLanguage()
  const [tab, setTab] = useState('homework')
  if (!student) return null
  return (
    <section className="grade-report" aria-label={`${student.name} progress`}>
      <div className="grades-classes" role="tablist" aria-label={t(lang, 'reportSection')}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'homework'}
          className={`tool-chip ${tab === 'homework' ? 'is-active' : ''}`}
          onClick={() => setTab('homework')}
        >
          {t(lang, 'homeworkTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'marks'}
          className={`tool-chip ${tab === 'marks' ? 'is-active' : ''}`}
          onClick={() => setTab('marks')}
        >
          {t(lang, 'marksTab')}
        </button>
      </div>
      {tab === 'marks' ? <MarksReport student={student} data={data} /> : <HomeworkProgress student={student} data={data} />}
    </section>
  )
}
