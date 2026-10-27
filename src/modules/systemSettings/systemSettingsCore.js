export const LOCAL_DATA_KEY = 'system_management_local_data'

function getStorage(storageOverride) {
  if (storageOverride) return storageOverride
  if (typeof window === 'undefined') return null
  return window.localStorage
}

/**
 * Education / academic session: 1 April → 31 March.
 * Apr–Dec of Y → "Y-(Y+1)"; Jan–Mar of Y → "(Y-1)-Y".
 */
export function academicSession(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth() // 0 = Jan … 3 = April
  if (month >= 3) return `${year}-${year + 1}`
  return `${year - 1}-${year}`
}

/** Same rule as academicSession — single source for new-school defaults. */
export function defaultSession(date = new Date()) {
  return academicSession(date)
}

/** Parse "2025-2026" → { startYear: 2025, endYear: 2026 }. */
export function parseSessionYears(session) {
  const m = String(session || '').trim().match(/^(\d{4})\s*[-/]\s*(\d{4})$/)
  if (m) return { startYear: Number(m[1]), endYear: Number(m[2]) }
  const label = academicSession()
  const parts = label.split('-').map(Number)
  return { startYear: parts[0], endYear: parts[1] }
}

/** Inclusive session bounds: 1 Apr startYear → 31 Mar endYear. */
export function sessionDateRange(session) {
  const { startYear, endYear } = parseSessionYears(session)
  return {
    startYear,
    endYear,
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
    label: `${startYear}-${endYear}`,
    display: `1 April ${startYear} – 31 March ${endYear}`,
  }
}

/** Card / certificate validity text from session label. */
export function formatSessionValidity(session) {
  const { startYear, endYear } = parseSessionYears(session || academicSession())
  return `April ${startYear} to March ${endYear}`
}

/**
 * Academic-year month list Apr→Mar for a session (or current session).
 * Each item: { month, year, value, label } where value is calendar month 1–12.
 */
export function academicYearMonths(session) {
  const { startYear, endYear } = parseSessionYears(session || academicSession())
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const order = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
  return order.map((month) => {
    const year = month >= 4 ? startYear : endYear
    return {
      month,
      year,
      value: month,
      label: `${names[month - 1]} ${year}`,
      shortLabel: names[month - 1].slice(0, 3),
      key: `${year}-${String(month).padStart(2, '0')}`,
    }
  })
}

export const normKey = (x) => String(x ?? '').trim().toLowerCase()

export function formatGradeLabel(grade) {
  let raw = String(grade || '').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  if (lower.startsWith('class ')) {
    const rest = raw.slice(6).trim()
    if (rest) raw = rest
  }
  const lower2 = raw.toLowerCase()
  if (['nursery', 'kg', 'k.g', 'k.g.', 'prep', 'play', 'play group', 'pg'].includes(lower2)) return 'Nursery'
  const n = parseInt(raw, 10)
  if (!Number.isNaN(n)) return `Class ${n}`
  return raw.toUpperCase()
}

export function formatClassDisplay(cls) {
  if (!cls) return ''
  const base = formatGradeLabel(cls.grade || cls.name || '')
  const sec = String(cls.section || '').trim().toUpperCase()
  return sec && sec !== '-' ? `${base}-${sec}` : base
}

// Resolve classId (id, name, grade, or display label) to the actual class object for consistent matching
export function resolveClass(classes, classId) {
  if (!classId || !Array.isArray(classes) || !classes.length) return null
  const raw = String(classId).trim()
  const norm = (v) => String(v || '').trim().toLowerCase()
  const clean = (v) => norm(v).replace(/[^a-z0-9]+/g, '')
  const parseGradeSection = (v) => {
    const s = String(v || '').trim()
    const m = s.match(/(?:class|grade)?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-_ ]\s*([a-z]))?/i)
    if (!m) return null
    return { grade: String(parseInt(m[1], 10)), section: (m[2] || '').toUpperCase() }
  }
  const n = norm(raw)
  const byId = classes.find((c) => c.id === classId || norm(c.id) === n)
  if (byId) return byId
  const byName = classes.find((c) => norm(c.name) === n)
  if (byName) return byName
  const byDisplay = classes.find((c) => norm(formatClassDisplay(c)) === n)
  if (byDisplay) return byDisplay
  const byGrade = classes.find((c) => norm(c.grade) === n)
  if (byGrade) return byGrade
  const byGradeLabel = classes.find((c) => norm(formatGradeLabel(c.grade)) === n)
  if (byGradeLabel) return byGradeLabel
  const gradeSection = classes.find((c) => norm(`${c.grade}-${c.section || ''}`.replace(/-+$/, '')) === n)
  if (gradeSection) return gradeSection
  // Flexible numeric matching: "3", "Class 3", "Grade 3", "3rd", "3-B"
  const parsed = parseGradeSection(raw)
  if (parsed) {
    const byNumeric = classes.filter((c) => {
      const g = String(c.grade || '').trim()
      const gNumMatch = g.match(/\d{1,2}/)
      const gNum = gNumMatch ? String(parseInt(gNumMatch[0], 10)) : ''
      return gNum === parsed.grade
    })
    if (parsed.section) {
      const byNumSec = byNumeric.find((c) => norm(c.section) === norm(parsed.section))
      if (byNumSec) return byNumSec
    }
    if (byNumeric.length === 1) return byNumeric[0]
  }
  // Last resort fuzzy compare
  const byFuzzy = classes.find((c) => {
    const candidates = [
      c.id,
      c.name,
      c.grade,
      formatGradeLabel(c.grade),
      formatClassDisplay(c),
      `${c.grade || ''}-${c.section || ''}`,
    ]
    return candidates.some((v) => clean(v) === clean(raw))
  })
  if (byFuzzy) return byFuzzy
  return null
}

export function getClassLabel(settingsOrClasses, classId) {
  if (!classId) return ''
  const classes = Array.isArray(settingsOrClasses)
    ? settingsOrClasses
    : settingsOrClasses && Array.isArray(settingsOrClasses.classes)
      ? settingsOrClasses.classes
      : []
  const cls = resolveClass(classes, classId)
  if (!cls) return String(classId)
  return formatClassDisplay(cls)
}

export function addSessionToList(sessions, newSession) {
  const session = String(newSession || '').trim()
  if (!/^\d{4}-\d{4}$/.test(session)) return Array.isArray(sessions) ? sessions : []
  const list = Array.isArray(sessions) ? sessions : []
  if (list.includes(session)) return list
  return [...list, session].sort()
}

export function loadSystemDataFromLocal(storageOverride) {
  try {
    const storage = getStorage(storageOverride)
    if (!storage) return null
    const raw = storage.getItem(LOCAL_DATA_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.schools) || data.schools.length === 0) return null
    return {
      schools: data.schools,
      activeSchoolId: data.activeSchoolId || data.schools[0]?.id || null,
    }
  } catch {
    return null
  }
}

export function saveSystemDataToLocal({ schools, activeSchoolId }, storageOverride) {
  try {
    const storage = getStorage(storageOverride)
    if (!storage) return
    const payload = {
      schools: Array.isArray(schools) ? schools : [],
      activeSchoolId: activeSchoolId || null,
    }
    storage.setItem(LOCAL_DATA_KEY, JSON.stringify(payload))
  } catch {
    // ignore persistence failures
  }
}
