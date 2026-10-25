const DEFAULT_MODEL = "gemini-3.8-flash"

function cleanText(value, max = 400) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max)
}

function clampCount(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.min(12, Math.round(n)))
}

function topicsPrompt({ classLabel, bookTitle, language }) {
  const lang = language === "urdu" ? "Urdu" : "English"
  return `You help a Punjab, Pakistan school teacher.
Textbook: "${bookTitle}"
Class: ${classLabel}
List 8 to 12 real chapter or topic names from this textbook for this class.
Write the topic names in ${lang}.
Return JSON only: {"topics":["topic 1","topic 2"]}
Do not include a different subject.`
}

function paperPrompt({ classLabel, bookTitle, topic, language, mcq, shortCount, longCount }) {
  const lang = language === "urdu" ? "Urdu" : "English"
  return `You are writing an original school exam for a Punjab, Pakistan classroom.
Class: ${classLabel}
Textbook: "${bookTitle}"
Topic: "${topic}"
Write every question in ${lang}.
Create original questions a teacher could set after teaching this topic. Do not copy sentences from the textbook.
Counts: ${mcq} MCQs, ${shortCount} short questions, ${longCount} long questions.
Each MCQ has exactly 4 options and correct is the index 0, 1, 2, or 3.
Return JSON only in this shape:
{"sections":[
  {"title":"Section A - Objective","type":"MCQs","instructions":"Choose the correct option.","questions":[{"text":"...","options":["A","B","C","D"],"correct":0}]},
  {"title":"Section B - Short Questions","type":"Short","instructions":"Answer briefly.","questions":[{"text":"..."}]},
  {"title":"Section C - Long Questions","type":"Long","instructions":"Answer in detail.","questions":[{"text":"..."}]}
]}`
}

function normalizeSections(parsed, counts) {
  const source = Array.isArray(parsed?.sections) ? parsed.sections : []
  const byType = {}
  source.forEach((section) => {
    const type = section?.type === "MCQs" || section?.type === "Short" || section?.type === "Long" ? section.type : ""
    if (type) byType[type] = section
  })
  const build = (type, title, instructions, limit, mapQuestion) => {
    const raw = Array.isArray(byType[type]?.questions) ? byType[type].questions : []
    const questions = raw.map(mapQuestion).filter((q) => q.text).slice(0, limit)
    const marks = type === "MCQs" ? questions.length : type === "Short" ? questions.length * 2 : questions.length * 5
    return {
      title: cleanText(byType[type]?.title, 80) || title,
      type,
      marks,
      instructions: cleanText(byType[type]?.instructions, 180) || instructions,
      questions,
    }
  }
  return [
    build("MCQs", "Section A - Objective", "Choose the correct option.", counts.mcq, (q) => {
      const options = Array.isArray(q?.options) ? q.options.map((opt) => cleanText(opt, 180)) : []
      while (options.length < 4) options.push("")
      const correct = Number(q?.correct)
      return {
        text: cleanText(q?.text, 400),
        options: options.slice(0, 4),
        correct: Number.isInteger(correct) && correct >= 0 && correct <= 3 ? correct : 0,
      }
    }),
    build("Short", "Section B - Short Questions", "Answer briefly.", counts.shortCount, (q) => ({
      text: cleanText(q?.text, 400),
    })),
    build("Long", "Section C - Long Questions", "Answer in detail.", counts.longCount, (q) => ({
      text: cleanText(q?.text, 500),
    })),
  ]
}

export async function handlePaperAi(body, options = {}) {
  const apiKey = String(options.apiKey || process.env.GEMINI_API_KEY || "").trim()
  if (!apiKey) {
    return {
      status: 503,
      body: { error: "Add GEMINI_API_KEY to .env.local, then restart the app." },
    }
  }

  const action = body?.action === "topics" ? "topics" : "paper"
  const classLabel = cleanText(body?.classLabel, 80)
  const bookTitle = cleanText(body?.bookTitle, 160)
  const topic = cleanText(body?.topic, 160)
  const language = body?.language === "urdu" ? "urdu" : "english"
  if (!classLabel || !bookTitle) {
    return { status: 400, body: { error: "Choose a class and a book from the book bank." } }
  }
  if (action === "paper" && !topic) {
    return { status: 400, body: { error: "Choose a topic from the book." } }
  }

  const counts = {
    mcq: clampCount(body?.mcq, 5),
    shortCount: clampCount(body?.short, 4),
    longCount: clampCount(body?.long, 2),
  }
  const model = cleanText(options.model || process.env.GEMINI_MODEL || DEFAULT_MODEL, 80) || DEFAULT_MODEL
  const prompt = action === "topics"
    ? topicsPrompt({ classLabel, bookTitle, language })
    : paperPrompt({ classLabel, bookTitle, topic, language, ...counts })

  let response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, responseMimeType: "application/json" },
        }),
      },
    )
  } catch {
    return { status: 502, body: { error: "Could not reach the AI service. Check the internet connection and try again." } }
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = cleanText(payload?.error?.message, 240) || "The AI service could not generate the paper."
    return { status: 502, body: { error: message } }
  }

  const text = (payload?.candidates?.[0]?.content?.parts || []).map((part) => part?.text || "").join("")
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { status: 502, body: { error: "The AI reply was not usable. Try again." } }
  }

  if (action === "topics") {
    const topics = (Array.isArray(parsed?.topics) ? parsed.topics : [])
      .map((item) => cleanText(item, 120))
      .filter(Boolean)
      .slice(0, 16)
    if (!topics.length) return { status: 502, body: { error: "No topics came back for this book. Try again." } }
    return { status: 200, body: { topics } }
  }

  const sections = normalizeSections(parsed, counts)
  const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0)
  if (!totalQuestions) return { status: 502, body: { error: "The AI paper was empty. Try again." } }
  return { status: 200, body: { sections } }
}
