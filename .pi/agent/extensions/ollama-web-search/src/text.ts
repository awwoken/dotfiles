export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function stripLeadingTitle(content: string, title: string): string {
  const text = normalizeText(content)
  const normalizedTitle = normalizeText(title)
  if (!normalizedTitle) return text

  const lowerText = text.toLowerCase()
  const lowerTitle = normalizedTitle.toLowerCase()
  if (lowerText.startsWith(lowerTitle)) {
    return text.slice(normalizedTitle.length).replace(/^\s*[-–—:|]*\s*/, "").trim()
  }
  return text
}
