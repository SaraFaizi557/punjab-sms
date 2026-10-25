const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]

const SUBJECT_HINTS = [
  { keys: ["math", "mathematics", "maths"], words: ["math", "mathematics"] },
  { keys: ["english"], words: ["english"] },
  { keys: ["urdu", "اردو"], words: ["urdu"] },
  { keys: ["islam", "islamiyat", "islamiat", "islamic"], words: ["islam", "islamiyat", "islamiat"] },
  { keys: ["science", "general science", "g.science", "g.sc"], words: ["science"] },
  { keys: ["computer", "computers"], words: ["computer"] },
  { keys: ["social", "pakistan studies", "pak studies", "history", "geography"], words: ["social", "pakistan", "geography", "history"] },
  { keys: ["general knowledge", "g.k", "g.kn", "gk"], words: ["general knowledge", "g.k"] },
  { keys: ["drawing", "art"], words: ["drawing", "art"] },
  { keys: ["arabic"], words: ["arabic"] },
  { keys: ["quran", "nazra", "tajveed", "qaida"], words: ["quran", "nazra", "qaida", "tajveed"] },
]

export function bookBankClassNames(grade) {
  const raw = String(grade || "").trim().toLowerCase()
  if (!raw) return []
  if (["ece", "nursery", "kg", "k.g", "pre", "pre-i", "prep", "play", "lkg", "ukg"].includes(raw)) {
    return ["Pre-I"]
  }
  const match = raw.match(/\d{1,2}/)
  const n = match ? parseInt(match[0], 10) : NaN
  if (!Number.isFinite(n) || n < 1 || n > 12) return []
  const names = [`Class-${ROMAN[n]}`]
  if (n === 9 || n === 10) names.push("Class IX-X")
  if (n === 11 || n === 12) names.push("Class XI-XII")
  return names
}

export function booksForGrade(catalog, grade) {
  const wanted = new Set(bookBankClassNames(grade))
  const classes = Array.isArray(catalog) ? catalog : []
  const books = []
  classes.forEach((entry) => {
    if (!wanted.has(entry?.className)) return
    ;(entry.books || []).forEach((book) => {
      const title = String(book?.title || "").trim()
      if (!title) return
      books.push({
        title,
        className: entry.className,
        url: book.url || "",
      })
    })
  })
  const seen = new Set()
  return books.filter((book) => {
    const key = book.title.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function bookMatchesSubject(title, subject) {
  const book = String(title || "").toLowerCase()
  const sub = String(subject || "").trim().toLowerCase()
  if (!sub) return true
  if (book.includes(sub)) return true
  const hint = SUBJECT_HINTS.find((row) => row.keys.some((key) => sub.includes(key) || key.includes(sub)))
  if (!hint) return false
  return hint.words.some((word) => book.includes(word))
}

export function paperLanguageForBook(title) {
  const book = String(title || "").toLowerCase()
  if (/urdu|islam|nazra|qaida|quran|arabic|punjabi|tarjuma|mutala|tajveed/.test(book)) return "urdu"
  return "english"
}
