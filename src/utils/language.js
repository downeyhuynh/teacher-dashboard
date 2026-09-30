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
