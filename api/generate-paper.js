import { handlePaperAi } from "../server/paperAi.mjs"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const result = await handlePaperAi(req.body || {})
  res.status(result.status).json(result.body)
}
