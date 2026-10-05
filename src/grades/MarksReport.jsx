import { useState } from 'react'
import {
  buildStudentMarks,
  formatAssessmentPercent,
  formatCategoryPercent,
  formatPointValue,
} from '../utils/academicMarks'
import { enrolledClassIds, subjectLabel } from '../utils/gradesStore'
import { t, useLanguage } from '../utils/language'

const SUBJECTS = ['Math', 'Science']

function subjectHeading(lang, subject) {
  if (subject === 'Math') return t(lang, 'math')
  if (subject === 'Science') return t(lang, 'science')
  return subject
}

function categoryTitle(lang, category) {
  return category.unassigned ? t(lang, 'unassignedCategory') : category.name
}

function AssessmentRow({ item, noGrade, excusedLabel }) {
  if (item.excused) {
    return (
      <tr>
        <td>{item.title}</td>
        <td>{excusedLabel}</td>
        <td>{excusedLabel}</td>
      </tr>
    )
  }
  if (!item.graded && item.points === 0) {
    return (
      <tr>
        <td>{item.title}</td>
        <td>
          0/{formatPointValue(item.maxPoints)}
        </td>
        <td>{noGrade}</td>
      </tr>
    )
  }
  if (!item.graded) {
    return (
      <tr>
        <td>{item.title}</td>
        <td>{noGrade}</td>
        <td>{noGrade}</td>
      </tr>
    )
  }
  return (
    <tr>
      <td>{item.title}</td>
      <td>
        {formatPointValue(item.points)}/{formatPointValue(item.maxPoints)}
      </td>
      <td>{formatAssessmentPercent(item.points, item.maxPoints)}</td>
    </tr>
  )
}

function CategoryDetail({ lang, category }) {
  const hasTotal = category.possible > 0
  return (
    <article className="marks-detail">
      <h3>{categoryTitle(lang, category)}</h3>
      {category.unassigned ? <p className="grades-help">{t(lang, 'unassignedNote')}</p> : null}
      <div className="grades-table-wrap">
        <table className="grades-table marks-table">
          <thead>
            <tr>
              <th scope="col">{t(lang, 'assessment')}</th>
              <th scope="col">{t(lang, 'points')}</th>
              <th scope="col">{t(lang, 'percentage')}</th>
            </tr>
          </thead>
          <tbody>
            {category.assessments.map((item) => (
              <AssessmentRow
                key={item.key}
                item={item}
                noGrade={t(lang, 'noGrade')}
                excusedLabel={t(lang, 'excused')}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t(lang, 'categoryTotal')}</th>
              <td>{hasTotal ? `${formatPointValue(category.earned)}/${formatPointValue(category.possible)}` : '—'}</td>
              <td>{formatCategoryPercent(category.percent)}</td>
            </tr>
            <tr>
              <th scope="row">{t(lang, 'progressReportMark')}</th>
              <td />
              <td className="marks-mark-value">{category.mark ?? '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  )
}

function HowCalculated({ lang }) {
  return (
    <details className="marks-explain">
      <summary>{t(lang, 'howCalculated')}</summary>
      <div className="marks-explain__body">
        <p>{t(lang, 'howCalculatedIntro')}</p>
        <p>{t(lang, 'howCalculatedCombine')}</p>
        <p>{t(lang, 'howCalculatedExample')}</p>
        <p className="marks-explain__math">77 ÷ 90 = 85.6%</p>
        <p>{t(lang, 'howCalculatedResult')}</p>
        <p>{t(lang, 'howCalculatedScaleLabel')}</p>
        <ul>
          <li>4 = 90–100%</li>
          <li>3 = 80–89%</li>
          <li>2 = 60–79%</li>
          <li>1 = {t(lang, 'below60')}</li>
        </ul>
        <p>{t(lang, 'howCalculatedHomework')}</p>
      </div>
    </details>
  )
}

export function MarksReport({ student, data }) {
  const lang = useLanguage()
  const report = buildStudentMarks(student, data)
  const enrolled = enrolledClassIds(student)
  const [subject, setSubject] = useState(
    enrolled.some((classId) => subjectLabel(classId) === 'Math') ? 'Math' : 'Science',
  )
  const entry = report.subjects.find((item) => item.subject === subject) || null
  const categories = (entry?.categories || []).filter((category) => !category.unassigned)

  return (
    <div className="marks-report">
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
            {subjectHeading(lang, name)}
          </button>
        ))}
      </div>
      <h3 className="marks-section-title">{t(lang, 'progressReportMarks')}</h3>
      {categories.length ? (
        <>
          <div className="marks-overview">
            <div className="marks-overview__grid">
              {categories.map((category) => (
                <article key={category.name} className="marks-category-card">
                  <h4>{category.name}</h4>
                  <p className="marks-category-card__percent">
                    {category.mark == null ? t(lang, 'noGrade') : formatCategoryPercent(category.percent)}
                  </p>
                  <p className="marks-category-card__mark">
                    <span>{t(lang, 'markLabel')}</span>
                    {category.mark ?? '—'}
                  </p>
                </article>
              ))}
            </div>
          </div>
          {categories.map((category) => (
            <CategoryDetail key={category.name} lang={lang} category={category} />
          ))}
        </>
      ) : (
        <p className="grades-empty">{t(lang, 'noAcademicWork')}</p>
      )}
      <HowCalculated lang={lang} />
    </div>
  )
}
