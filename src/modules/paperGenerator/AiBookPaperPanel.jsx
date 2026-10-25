import { useEffect, useMemo, useState } from "react"
import { fetchPtbbBooks } from "@/bookBankService.js"
import { formatClassDisplay, getClassSubjects } from "@/shared/helpers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { bookMatchesSubject, booksForGrade, paperLanguageForBook } from "./bookBankPapers.js"
import { requestPaperAi } from "./paperAiClient.js"

function newId() {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function AiBookPaperPanel({ settings, onApplyPaper, onSaveToBank }) {
  const classes = settings?.classes || []
  const [classId, setClassId] = useState(classes[0]?.id || "")
  const [catalog, setCatalog] = useState([])
  const [bookTitle, setBookTitle] = useState("")
  const [topics, setTopics] = useState([])
  const [topic, setTopic] = useState("")
  const [customTopic, setCustomTopic] = useState("")
  const [mcq, setMcq] = useState(5)
  const [shortCount, setShortCount] = useState(4)
  const [longCount, setLongCount] = useState(2)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState("")
  const [sections, setSections] = useState(null)

  const classRecord = classes.find((item) => item.id === classId) || null
  const classLabel = classRecord ? formatClassDisplay(classRecord) : ""
  const subjects = getClassSubjects(settings, classId, "exam")
  const [subject, setSubject] = useState(subjects[0] || "")

  useEffect(() => {
    const next = getClassSubjects(settings, classId, "exam")
    setSubject((current) => (next.includes(current) ? current : (next[0] || "")))
    setBookTitle("")
    setTopics([])
    setTopic("")
    setSections(null)
  }, [classId])

  useEffect(() => {
    let cancelled = false
    fetchPtbbBooks()
      .then((rows) => {
        if (!cancelled) setCatalog(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setStatus("The book bank could not be loaded.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const books = useMemo(() => booksForGrade(catalog, classRecord?.grade), [catalog, classRecord?.grade])
  const matchingBooks = useMemo(() => {
    const matched = books.filter((book) => bookMatchesSubject(book.title, subject))
    return matched.length ? matched : books
  }, [books, subject])

  useEffect(() => {
    if (!matchingBooks.length) {
      setBookTitle("")
      return
    }
    if (!matchingBooks.some((book) => book.title === bookTitle)) {
      setBookTitle(matchingBooks[0].title)
    }
  }, [matchingBooks, bookTitle])

  const language = paperLanguageForBook(bookTitle)
  const chosenTopic = (customTopic || topic).trim()

  const loadTopics = async () => {
    if (!bookTitle || !classLabel) return
    setBusy("topics")
    setStatus("")
    setTopics([])
    setTopic("")
    try {
      const data = await requestPaperAi({
        action: "topics",
        classLabel,
        bookTitle,
        language,
      })
      const list = Array.isArray(data.topics) ? data.topics : []
      setTopics(list)
      setTopic(list[0] || "")
      setStatus(list.length ? `${list.length} topics loaded from ${bookTitle}.` : "No topics were returned.")
    } catch (error) {
      setStatus(error.message || "Could not load topics.")
    } finally {
      setBusy("")
    }
  }

  const generate = async () => {
    if (!bookTitle || !classLabel || !chosenTopic) {
      setStatus("Choose a class, book, and topic first.")
      return
    }
    setBusy("paper")
    setStatus("")
    try {
      const data = await requestPaperAi({
        action: "paper",
        classLabel,
        bookTitle,
        topic: chosenTopic,
        language,
        mcq,
        short: shortCount,
        long: longCount,
      })
      const next = (data.sections || []).map((section) => ({
        ...section,
        id: newId(),
        questions: (section.questions || []).map((question) => ({ ...question, id: newId() })),
      }))
      setSections(next)
      const count = next.reduce((sum, section) => sum + section.questions.length, 0)
      setStatus(`${count} questions ready for ${chosenTopic}.`)
    } catch (error) {
      setStatus(error.message || "Could not generate the paper.")
    } finally {
      setBusy("")
    }
  }

  const saveBank = () => {
    if (!sections || !onSaveToBank || !classId) return
    const questions = sections.flatMap((section) =>
      section.questions.map((question) => ({
        id: newId(),
        type: section.type,
        text: question.text,
        options: question.options,
        correct: question.correct ?? 0,
        chapter: bookTitle,
        topic: chosenTopic,
        difficulty: "Medium",
      })),
    )
    onSaveToBank(classId, subject || bookTitle, questions)
    setStatus("Saved into the question bank for this class.")
  }

  return (
    <Card size="sm" className="shadow-none">
      <CardHeader className="border-b">
        <CardTitle>AI paper from book bank</CardTitle>
        <CardDescription>
          Pick the class book and a topic. The paper is written as original questions for that lesson.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-(--card-spacing)">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Class</Label>
            <NativeSelect size="sm" value={classId} onChange={(event) => setClassId(event.target.value)}>
              {classes.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>{formatClassDisplay(item)}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Subject</Label>
            <NativeSelect size="sm" value={subject} onChange={(event) => setSubject(event.target.value)}>
              {subjects.map((item) => (
                <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Book</Label>
            <NativeSelect size="sm" value={bookTitle} onChange={(event) => { setBookTitle(event.target.value); setTopics([]); setTopic(""); }}>
              {matchingBooks.map((book) => (
                <NativeSelectOption key={book.title} value={book.title}>{book.title}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Topic from the book</Label>
            <NativeSelect size="sm" value={topic} onChange={(event) => setTopic(event.target.value)} disabled={!topics.length}>
              {!topics.length ? <NativeSelectOption value="">Load topics first</NativeSelectOption> : null}
              {topics.map((item) => (
                <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs">Or type a topic</Label>
            <Input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="Chapter or lesson name" />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">MCQs</Label>
            <Input type="number" min={1} max={12} className="w-20" value={mcq} onChange={(event) => setMcq(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Short</Label>
            <Input type="number" min={1} max={12} className="w-20" value={shortCount} onChange={(event) => setShortCount(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Long</Label>
            <Input type="number" min={1} max={12} className="w-20" value={longCount} onChange={(event) => setLongCount(event.target.value)} />
          </div>
          <Button type="button" variant="outline" disabled={!bookTitle || busy === "topics"} onClick={loadTopics}>
            {busy === "topics" ? "Loading topics…" : "Load topics"}
          </Button>
          <Button type="button" disabled={!bookTitle || !chosenTopic || busy === "paper"} onClick={generate}>
            {busy === "paper" ? "Writing paper…" : "Generate paper"}
          </Button>
        </div>

        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        {!books.length && catalog.length ? (
          <p className="text-sm text-muted-foreground">No book-bank books match this class yet.</p>
        ) : null}

        {sections ? (
          <div className="space-y-3 rounded-lg border p-4">
            {sections.map((section) => (
              <div key={section.id}>
                <div className="mb-1 flex justify-between text-sm font-semibold">
                  <span>{section.title}</span>
                  <span>Marks: {section.marks}</span>
                </div>
                <p className="mb-2 text-xs italic text-muted-foreground">{section.instructions}</p>
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  {section.questions.map((question) => (
                    <li key={question.id}>
                      {question.text}
                      {section.type === "MCQs" ? (
                        <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          {(question.options || []).map((option, index) => (
                            <span key={index}>({String.fromCharCode(65 + index)}) {option}</span>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => onApplyPaper?.(sections)}>Open in paper editor</Button>
              <Button type="button" variant="outline" onClick={saveBank}>Save to question bank</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
