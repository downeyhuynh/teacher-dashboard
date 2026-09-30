import { gradebook } from '../data/gradebook'

export const PORTAL_SESSION_KEY = 'teacher-dashboard.portal-session'

export const GRADE_CLASSES = [
  { id: 'caltech-math', label: 'Caltech Math', subject: 'Math' },
  { id: 'caltech-science', label: 'Caltech Science', subject: 'Science' },
  { id: 'hawaii-math', label: 'Hawaii Math', subject: 'Math' },
  { id: 'hawaii-science', label: 'Hawaii Science', subject: 'Science' },
]

function classMeta(classId) {
  return GRADE_CLASSES.find((entry) => entry.id === classId) || null
}

export function classLabel(classId, lang = 'en') {
  const meta = classMeta(classId)
  if (!meta) return lang === 'es' ? 'Clase' : 'Class'
  if (lang !== 'es') return meta.label
  const subject = meta.subject === 'Math' ? 'Matemáticas' : 'Ciencias'
  const school = classId.startsWith('hawaii') ? 'Hawaii' : 'Caltech'
  return `${subject} ${school}`
}

export function subjectLabel(classId) {
  return classMeta(classId)?.subject || classLabel(classId)
}

function publishedGrades() {
  const lastUpdated = gradebook.lastUpdated || null
  const classes = {}
  for (const entry of GRADE_CLASSES) {
    const raw = gradebook.classes?.[entry.id]
    const assignments = Array.isArray(raw?.assignments)
      ? raw.assignments
          .filter((item) => item && item.id && item.title)
          .map((item) => ({
            id: String(item.id),
            title: String(item.title),
            category: item.category === 'test' || item.category === 'quiz' ? item.category : 'assignment',
            maxPoints: Number(item.maxPoints) > 0 ? Number(item.maxPoints) : 100,
          }))
      : []
    classes[entry.id] = {
      id: entry.id,
      label: entry.label,
      updatedAt: lastUpdated,
      assignments,
    }
  }

  const students = (Array.isArray(gradebook.students) ? gradebook.students : [])
    .filter((student) => student?.id && student?.name)
    .map((student) => ({
      id: String(student.id),
      name: String(student.name).trim(),
      pin: /^\d{6}$/.test(String(student.pin || '')) ? String(student.pin) : null,
      classes: student.classes && typeof student.classes === 'object' ? student.classes : {},
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { lastUpdated, students, classes }
}

const grades = publishedGrades()

export function getGrades() {
  return grades
}

export function studentsInClass(data, classId) {
  return data.students.filter((student) => student.classes?.[classId])
}

export function enrolledClassIds(student) {
  return GRADE_CLASSES.map((entry) => entry.id).filter((id) => student?.classes?.[id])
}

export function summarizeClass(student, classRecord) {
  const groups = { test: [], quiz: [], assignment: [] }
  const missing = []
  let earned = 0
  let possible = 0
  if (!student || !classRecord) {
    return { percent: null, earned: 0, possible: 0, missing, groups }
  }
  if (!student.classes?.[classRecord.id]) {
    return { percent: null, earned: 0, possible: 0, missing, groups }
  }
  const scores = student.classes[classRecord.id].scores || {}
  for (const assignment of classRecord.assignments) {
    const score = scores[assignment.id]
    if (score?.excused) continue
    const max = Number(assignment.maxPoints) || 0
    const hasPoints = score && score.points != null && !Number.isNaN(Number(score.points))
    const scoredZero = hasPoints && Number(score.points) === 0
    if (!score || score.missing || scoredZero || !hasPoints) {
      const missingScore = { points: 0, missing: true, excused: false }
      missing.push(assignment)
      earned += 0
      possible += max
      groups[assignment.category].push({ assignment, score: missingScore })
      continue
    }
    earned += Number(score.points)
    possible += max
    groups[assignment.category].push({ assignment, score })
  }
  const percent = possible > 0 ? (earned / possible) * 100 : null
  return { percent, earned, possible, missing, groups }
}

export function formatUpdated(value, lang = 'en') {
  if (!value) return lang === 'es' ? 'Aún no publicado' : 'Not yet published'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString(lang === 'es' ? 'es' : 'en', { dateStyle: 'long' })
}

export function formatScore(score, maxPoints) {
  if (!score || score.excused) return 'Excused'
  if (score.missing) return 'Missing'
  if (score.points == null) return '—'
  return `${score.points}/${maxPoints}`
}

function hashesEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashMatches(salt, code, expected) {
  const encoded = new TextEncoder().encode(`${salt}:${code}`)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return hashesEqual(bytesToHex(digest), expected)
}

export async function pinMatches(student, pin) {
  const code = String(pin || '').replace(/\s+/g, '')
  if (!/^\d{6}$/.test(code)) return false
  if (gradebook.accessSalt && gradebook.accessHash) {
    if (await hashMatches(gradebook.accessSalt, code, gradebook.accessHash)) return true
  }
  if (!student?.pin) return false
  return hashesEqual(student.pin, code)
}

export function searchStudents(data, query) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return []
  return data.students.filter((student) => student.name.toLowerCase().includes(needle))
}

export function readPortalSession() {
  try {
    const raw = sessionStorage.getItem(PORTAL_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.studentId) return null
    return parsed.studentId
  } catch {
    return null
  }
}

export function writePortalSession(studentId) {
  sessionStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify({ studentId }))
}

export function clearPortalSession() {
  sessionStorage.removeItem(PORTAL_SESSION_KEY)
}
