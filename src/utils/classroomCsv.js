/**
 * Google Classroom "Download all grades" CSV.
 *
 * Typical columns:
 *   First Name, Last Name, Email, Overall Grade, then one column per assignment.
 * Assignment headers may include points, e.g. "Quiz: Forces (20)".
 * Cells may be a number, blank, "Missing", or "Excused".
 * A preamble before the header row is skipped. A following row of point values
 * (empty name cells, numeric assignment cells) is treated as the maximums.
 */

function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') {
      cell += ch
    }
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function columnKind(header) {
  const text = String(header || '').trim().toLowerCase()
  if (!text) return 'ignore'
  if (text === 'first name' || text === 'firstname') return 'first'
  if (text === 'last name' || text === 'lastname' || text === 'surname') return 'last'
  if (text === 'name' || text === 'student' || text === 'student name' || text === 'full name') {
    return 'full'
  }
  if (
    text.includes('email') ||
    text.includes('student id') ||
    text.includes('user id') ||
    text.includes('sis') ||
    text.includes('overall') ||
    text.includes('total') ||
    text === 'id' ||
    text === 'class'
  ) {
    return 'ignore'
  }
  return 'assignment'
}

export function categoryForTitle(title) {
  const text = String(title || '').toLowerCase()
  if (/\b(tests?|exams?)\b/.test(text)) return 'test'
  if (/\bquizzes?\b|\bquiz\b/.test(text)) return 'quiz'
  return 'assignment'
}

function parseAssignmentHeader(header) {
  const raw = String(header || '').trim()
  const match = raw.match(/^(.*?)(?:\s*[[(]\s*(\d+(?:\.\d+)?)\s*(?:points?)?\s*[\])])\s*$/i)
  if (match && match[1].trim()) {
    return { title: match[1].trim(), maxPoints: Number(match[2]) }
  }
  return { title: raw, maxPoints: null }
}

function parseScore(raw) {
  const text = String(raw ?? '').trim()
  if (!text || text === '-' || text === '—' || /^ungraded$/i.test(text)) {
    return { points: 0, missing: true, excused: false }
  }
  if (/^(missing|not turned in|absent)$/i.test(text)) {
    return { points: 0, missing: true, excused: false }
  }
  if (/^excused$/i.test(text)) {
    return { points: null, missing: false, excused: true }
  }
  const num = Number(text.replace(/%$/, '').replace(/,/g, ''))
  if (Number.isFinite(num)) return { points: num, missing: num === 0, excused: false }
  return { points: null, missing: false, excused: false, unrecognized: true }
}

function findHeaderIndex(rows) {
  const limit = Math.min(rows.length, 25)
  for (let i = 0; i < limit; i += 1) {
    const kinds = rows[i].map(columnKind)
    const hasName = kinds.includes('first') || kinds.includes('last') || kinds.includes('full')
    if (hasName) return i
  }
  return -1
}

function studentName(row, columns) {
  let first = ''
  let last = ''
  let full = ''
  for (const column of columns) {
    const value = String(row[column.index] ?? '').trim()
    if (column.kind === 'first') first = value
    else if (column.kind === 'last') last = value
    else if (column.kind === 'full') full = value
  }
  if (full) return full
  return `${first} ${last}`.trim()
}

function isPointsRow(row, columns) {
  const name = studentName(row, columns).toLowerCase()
  if (name && name !== 'points') return false
  const assignmentColumns = columns.filter((column) => column.kind === 'assignment')
  if (!assignmentColumns.length) return false
  let numeric = 0
  for (const column of assignmentColumns) {
    const text = String(row[column.index] ?? '').trim()
    if (!text) continue
    if (!Number.isFinite(Number(text))) return false
    numeric += 1
  }
  return numeric >= Math.ceil(assignmentColumns.length / 2)
}

/**
 * Parse a Classroom grade CSV into assignments + student score rows.
 * Returns { ok, error, warnings, assignments, students }.
 */
export function parseClassroomCsv(text) {
  const rows = parseCsv(text).filter((row) => row.some((cell) => String(cell).trim()))
  const headerIndex = findHeaderIndex(rows)
  if (headerIndex < 0) {
    return {
      ok: false,
      error: 'This file does not look like a Google Classroom grade export. It needs First Name and Last Name columns.',
      warnings: [],
      assignments: [],
      students: [],
    }
  }

  const header = rows[headerIndex]
  const columns = header.map((label, index) => ({ index, kind: columnKind(label), label }))
  const warnings = []
  const seenTitles = new Map()
  const assignments = []

  for (const column of columns) {
    if (column.kind !== 'assignment') continue
    const parsed = parseAssignmentHeader(column.label)
    if (!parsed.title) continue
    const key = parsed.title.toLowerCase()
    const count = (seenTitles.get(key) || 0) + 1
    seenTitles.set(key, count)
    const title = count === 1 ? parsed.title : `${parsed.title} (${count})`
    if (count > 1) warnings.push(`Two columns are named “${parsed.title}”. The second was kept separately.`)
    assignments.push({
      column: column.index,
      title,
      category: categoryForTitle(parsed.title),
      maxPoints: parsed.maxPoints,
    })
  }

  if (!assignments.length) {
    return {
      ok: false,
      error: 'No assignment columns were found next to the student names.',
      warnings,
      assignments: [],
      students: [],
    }
  }

  let start = headerIndex + 1
  while (rows[start] && /^date$/i.test(studentName(rows[start], columns))) start += 1
  if (rows[start] && isPointsRow(rows[start], columns)) {
    for (const assignment of assignments) {
      const value = Number(String(rows[start][assignment.column] ?? '').trim())
      if (Number.isFinite(value) && value > 0) assignment.maxPoints = value
    }
    start += 1
  }

  const students = []
  const seenStudents = new Set()
  let skipped = 0
  let unrecognized = 0

  for (let i = start; i < rows.length; i += 1) {
    const name = studentName(rows[i], columns)
    if (/^date$/i.test(name)) {
      skipped += 1
      continue
    }
    if (!name) {
      skipped += 1
      continue
    }
    const key = name.toLowerCase()
    if (seenStudents.has(key)) {
      warnings.push(`${name} appears more than once. The last row was used.`)
      const existing = students.findIndex((student) => student.name.toLowerCase() === key)
      if (existing >= 0) students.splice(existing, 1)
    }
    seenStudents.add(key)

    const scores = assignments.map((assignment) => {
      const score = parseScore(rows[i][assignment.column])
      if (score.unrecognized) unrecognized += 1
      return {
        title: assignment.title,
        points: score.points,
        missing: score.missing,
        excused: score.excused,
      }
    })
    students.push({ name, scores })
  }

  if (!students.length) {
    return {
      ok: false,
      error: 'The file has assignment columns but no student rows.',
      warnings,
      assignments: [],
      students: [],
    }
  }

  for (const assignment of assignments) {
    if (assignment.maxPoints != null) continue
    let max = 0
    for (const student of students) {
      const score = student.scores.find((item) => item.title === assignment.title)
      if (score && !score.missing && !score.excused && score.points != null) {
        max = Math.max(max, score.points)
      }
    }
    assignment.maxPoints = max > 0 ? max : 100
    warnings.push(`“${assignment.title}” had no point value in the file. Its maximum was set to ${assignment.maxPoints}.`)
  }

  if (skipped) warnings.push(`${skipped} row${skipped === 1 ? '' : 's'} without a name ${skipped === 1 ? 'was' : 'were'} skipped.`)
  if (unrecognized) {
    warnings.push(`${unrecognized} grade cell${unrecognized === 1 ? '' : 's'} could not be read and ${unrecognized === 1 ? 'was' : 'were'} left blank.`)
  }

  return {
    ok: true,
    error: '',
    warnings,
    assignments: assignments.map(({ title, category, maxPoints }) => ({ title, category, maxPoints })),
    students,
  }
}
