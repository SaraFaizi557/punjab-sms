export async function requestPaperAi(payload) {
  const response = await fetch("/api/generate-paper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || "Could not generate the paper.")
  }
  return data
}
