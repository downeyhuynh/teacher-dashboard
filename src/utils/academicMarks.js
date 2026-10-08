import { enrolledClassIds, subjectLabel } from './gradesStore'

const SUBJECT_ORDER = ['Math', 'Science']

/**
 * Title patterns used only when a quiz or test has no academicCategory.
 * An explicit academicCategory always wins, including future category names.
 */
const CATEGORY_PATTERNS = [
  {
    subject: 'Math',
    pattern: /\bmodule\s*2\b|\bm2\b/i,
    name: 'The Number System (NS)',
  },
  {
    subject: 'Math',
    pattern: /\bmodule\s*1\b|\bm1\b|\btopic\s*[ab]\b/i,
    name: 'Ratios and Proportional Relationships',
  },
  {
    subject: 'Science',
    pattern: /\bunit\s*1\b|\bquiz\s*1(?:\.2)?\b|\bphysical\s+science\b/i,
    name: 'Physical Science (PS)',
  },
]

export function resolveAcademicCategory(assignment, subject) {
  const explicit = String(assignment?.academicCategory || '').trim()
  if (explicit) return explicit
  const title = String(assignment?.title || '')
  const match = CATEGORY_PATTERNS.find((rule) => rule.subject === subject && rule.pattern.test(title))
  return match?.name || ''
}

/**
 * Every quiz and test stays on the list.
 * A blank quiz or test is excused. An excused quiz or test counts as completed and earns full points.
 * A recorded 0 is shown as 0 and left out until it is a real graded score.
 */
export function readGradedScore(score, maxPoints) {
  const max = Number(maxPoints)
  const safeMax = Number.isFinite(max) && max > 0 ? max : 0
  if (score?.excused) {
    return { status: 'graded', graded: true, excused: false, points: safeMax, maxPoints: safeMax }
  }
  const hasPoints = score && score.points != null && Number.isFinite(Number(score.points))
  const points = hasPoints ? Number(score.points) : null
  if (!score || score.missing || !hasPoints) {
    return { status: 'missing', graded: false, excused: false, points, maxPoints: safeMax }
  }
  return { status: 'graded', graded: true, excused: false, points, maxPoints: safeMax }
}

/** Mark follows the percentage parents see, rounded to one decimal. */
export function markFromPercent(percent) {
  if (percent == null || !Number.isFinite(percent)) return null
  const shown = Math.round(percent * 10) / 10
  if (shown >= 90) return 4
  if (shown >= 80) return 3
  if (shown >= 60) return 2
  return 1
}

export function formatPointValue(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function formatCategoryPercent(percent) {
  if (percent == null || !Number.isFinite(percent)) return '—'
  const rounded = Math.round(percent * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

export function formatAssessmentPercent(points, maxPoints) {
  const earned = Number(points)
  const max = Number(maxPoints)
  if (!Number.isFinite(earned) || !Number.isFinite(max) || max <= 0) return '—'
  return formatCategoryPercent((earned / max) * 100)
}

/**
 * Category percentage is total points earned divided by total points possible.
 * Assessment percentages are never averaged. Ungraded items are left out of both sums.
 * The 1–4 mark belongs to the category, not to each quiz or test.
 */
export function summarizeCategory(assessments) {
  let earned = 0
  let possible = 0
  for (const item of assessments) {
    if (!item.graded) continue
    earned += item.points
    possible += item.maxPoints
  }
  if (possible <= 0) {
    return { earned: 0, possible: 0, percent: null, mark: null }
  }
  const percent = (earned / possible) * 100
  return { earned, possible, percent, mark: markFromPercent(percent) }
}

function subjectRank(subject) {
  const index = SUBJECT_ORDER.indexOf(subject)
  return index === -1 ? SUBJECT_ORDER.length : index
}

export function buildStudentMarks(student, data) {
  const categoriesBySubject = new Map()

  const ensureCategory = (subject, name) => {
    if (!categoriesBySubject.has(subject)) categoriesBySubject.set(subject, new Map())
    const categories = categoriesBySubject.get(subject)
    if (!categories.has(name)) categories.set(name, [])
    return categories.get(name)
  }

  for (const classId of enrolledClassIds(student)) {
    const subject = subjectLabel(classId)
    const classRecord = data.classes?.[classId]
    if (!classRecord) continue
    const scores = student.classes?.[classId]?.scores || {}
    const seen = new Set()

    for (const assignment of classRecord.assignments) {
      if (assignment.category !== 'quiz' && assignment.category !== 'test') continue
      const key = `${subject}:${assignment.id}`
      if (seen.has(key)) continue
      seen.add(key)

      const graded = readGradedScore(scores[assignment.id], assignment.maxPoints)
      const categoryName = resolveAcademicCategory(assignment, subject)
      ensureCategory(subject, categoryName).push({
        key,
        title: assignment.title,
        status: graded.status,
        graded: graded.graded,
        excused: graded.excused,
        points: graded.points,
        maxPoints: graded.maxPoints,
      })
    }
  }

  const subjects = [...categoriesBySubject.entries()]
    .sort((a, b) => subjectRank(a[0]) - subjectRank(b[0]))
    .map(([subject, categories]) => {
      const named = []
      const unassigned = []
      for (const [name, assessments] of categories) {
        const totals = summarizeCategory(assessments)
        const entry = {
          name,
          unassigned: !name,
          assessments,
          ...totals,
          mark: name ? totals.mark : null,
        }
        if (name) named.push(entry)
        else unassigned.push(entry)
      }
      return { subject, categories: [...named, ...unassigned] }
    })

  return { subjects }
}
