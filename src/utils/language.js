import { useEffect, useState } from 'react'

const STORAGE_KEY = 'teacher-dashboard.language'
const CHANGE_EVENT = 'teacher-dashboard-language'

const COPY = {
  en: {
    homeKicker: 'Choose where to go',
    homeTitle: 'Teacher Dashboard',
    dashboardLabel: 'Teacher Dashboard',
    dashboardDetail: 'Slides, timers, agenda, and classroom tools',
    portalLabel: 'Progress Report',
    portalDetail: 'Family view of a student’s grades',
    language: 'Language',
    home: 'Home',
    familyAccess: 'Family access',
    progressReport: 'Progress Report',
    portalHelp:
      'Choose a student, then enter the 6-digit family access code. Grades stay hidden until the code matches.',
    searchStudent: 'Search or select student',
    searchPlaceholder: 'Search student...',
    matchingStudents: 'Matching students',
    noMatches: 'No matching students.',
    accessCode: 'Family access code',
    viewProgress: 'View progress',
    tooMany: 'Too many attempts. Wait a moment and try again.',
    chooseName: 'Search for a student and choose the matching name.',
    codeMismatch: 'That family access code doesn’t match.',
    signOut: 'Sign out',
    totalMissing: 'Total missing work',
    lastUpdated: 'Last updated',
    subject: 'Subject',
    missingWork: 'Missing work',
    tests: 'Tests',
    quizzes: 'Quizzes',
    none: 'None',
    missingMark: 'Missing',
    math: 'Math',
    science: 'Science',
    classWord: 'Class',
    reportSection: 'Student report',
    homeworkTab: 'Homework',
    marksTab: 'Marks',
    progressReportMarks: 'Progress Report Marks',
    assessment: 'Assessment',
    points: 'Points',
    percentage: 'Percentage',
    categoryTotal: 'Category total',
    progressReportMark: 'Progress report mark',
    markLabel: 'Mark',
    noGrade: 'N/A — No Grade',
    excused: 'Excused',
    noAcademicWork: 'No quizzes or tests yet.',
    noCategoryMarks: 'No category has a grade yet.',
    unassignedCategory: 'Unassigned',
    unassignedNote: 'Assign an academic category to give these assessments a progress report mark.',
    howCalculated: 'How is this mark calculated?',
    howCalculatedIntro: 'Progress report marks are calculated by academic category.',
    howCalculatedCombine: 'All quiz and test points within a category are combined.',
    howCalculatedExample:
      'For example, if a student earns 77 total points out of 90 possible points in Ratios and Proportional Relationships:',
    howCalculatedResult: 'An 85.6% corresponds to a Progress Report Mark of 3.',
    howCalculatedScaleLabel: 'The scale is:',
    below60: 'Below 60%',
    howCalculatedHomework: 'Homework is tracked separately and does not affect these academic marks.',
  },
  es: {
    homeKicker: 'Elige a dónde ir',
    homeTitle: 'Panel del maestro',
    dashboardLabel: 'Panel del maestro',
    dashboardDetail: 'Diapositivas, temporizadores, agenda y herramientas del salón',
    portalLabel: 'Informe de progreso',
    portalDetail: 'Vista familiar de las calificaciones',
    language: 'Idioma',
    home: 'Inicio',
    familyAccess: 'Acceso familiar',
    progressReport: 'Informe de progreso',
    portalHelp:
      'Elige un estudiante y escribe el código familiar de 6 dígitos. Las calificaciones permanecen ocultas hasta que el código coincida.',
    searchStudent: 'Busca o elige al estudiante',
    searchPlaceholder: 'Buscar estudiante...',
    matchingStudents: 'Estudiantes que coinciden',
    noMatches: 'No hay estudiantes que coincidan.',
    accessCode: 'Código de acceso familiar',
    viewProgress: 'Ver progreso',
    tooMany: 'Demasiados intentos. Espera un momento y vuelve a intentar.',
    chooseName: 'Busca un estudiante y elige el nombre que coincide.',
    codeMismatch: 'Ese código de acceso familiar no coincide.',
    signOut: 'Cerrar sesión',
    totalMissing: 'Total de trabajo faltante',
    lastUpdated: 'Última actualización',
    subject: 'Materia',
    missingWork: 'Trabajo faltante',
    tests: 'Exámenes',
    quizzes: 'Pruebas',
    none: 'Ninguno',
    missingMark: 'Falta',
    math: 'Matemáticas',
    science: 'Ciencias',
    classWord: 'Clase',
    reportSection: 'Informe del estudiante',
    homeworkTab: 'Tarea',
    marksTab: 'Calificaciones',
    progressReportMarks: 'Calificaciones del informe de progreso',
    assessment: 'Evaluación',
    points: 'Puntos',
    percentage: 'Porcentaje',
    categoryTotal: 'Total de la categoría',
    progressReportMark: 'Calificación del informe',
    markLabel: 'Calificación',
    noGrade: 'N/A — Sin calificación',
    excused: 'Justificado',
    noAcademicWork: 'Todavía no hay pruebas ni exámenes.',
    noCategoryMarks: 'Ninguna categoría tiene calificación todavía.',
    unassignedCategory: 'Sin categoría',
    unassignedNote: 'Asigna una categoría académica para dar a estas evaluaciones una calificación del informe.',
    howCalculated: '¿Cómo se calcula esta calificación?',
    howCalculatedIntro: 'Las calificaciones del informe de progreso se calculan por categoría académica.',
    howCalculatedCombine: 'Se combinan todos los puntos de pruebas y exámenes dentro de una categoría.',
    howCalculatedExample:
      'Por ejemplo, si un estudiante obtiene 77 puntos de 90 posibles en Ratios and Proportional Relationships:',
    howCalculatedResult: 'Un 85.6% corresponde a una calificación del informe de progreso de 3.',
    howCalculatedScaleLabel: 'La escala es:',
    below60: 'Menos de 60%',
    howCalculatedHomework: 'La tarea se registra por separado y no afecta estas calificaciones académicas.',
  },
}

export function getLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'es' ? 'es' : 'en'
  } catch {
    return 'en'
  }
}

export function setLanguage(lang) {
  const next = lang === 'es' ? 'es' : 'en'
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore private browsing */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useLanguage() {
  const [lang, setLang] = useState(getLanguage)

  useEffect(() => {
    const onChange = () => setLang(getLanguage())
    window.addEventListener(CHANGE_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return lang
}

export function t(lang, key) {
  return COPY[lang]?.[key] || COPY.en[key] || key
}
