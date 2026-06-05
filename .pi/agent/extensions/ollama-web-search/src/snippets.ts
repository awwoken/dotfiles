import { DEFAULT_SNIPPET_CHARS, STOP_WORDS } from "./constants.ts"
import { stripLeadingTitle } from "./text.ts"
import type { SearchResult } from "./types.ts"

function queryTerms(query: string): string[] {
  const seen = new Set<string>()
  const terms: string[] = []
  for (const term of query.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? []) {
    if (term.length < 2 || STOP_WORDS.has(term) || seen.has(term)) continue
    seen.add(term)
    terms.push(term)
  }
  return terms
}

function scoreWindow(window: string, terms: string[]): number {
  let score = 0
  for (const term of terms) {
    let idx = window.indexOf(term)
    while (idx !== -1) {
      score += term.length >= 5 ? 3 : 1
      idx = window.indexOf(term, idx + term.length)
    }
  }
  return score
}

function wordBoundaryStart(text: string, start: number): number {
  if (start <= 0) return 0
  const boundary = text.lastIndexOf(" ", start)
  return boundary === -1 ? start : boundary + 1
}

function truncateSnippet(text: string, start: number, limit: number): string {
  const safeStart = wordBoundaryStart(text, start)
  const prefix = safeStart > 0 ? "…" : ""
  let body = text.slice(safeStart, safeStart + limit)

  if (safeStart + limit < text.length) {
    const lastSpace = body.lastIndexOf(" ")
    if (lastSpace > Math.floor(limit * 0.7)) body = body.slice(0, lastSpace)
    return `${prefix}${body.trim()}…`
  }

  return `${prefix}${body.trim()}`
}

export function buildSnippet(result: SearchResult, query: string): string {
  const text = stripLeadingTitle(result.content ?? "", result.title ?? "")
  if (!text) return ""

  const terms = queryTerms(query)
  if (terms.length === 0) return truncateSnippet(text, 0, DEFAULT_SNIPPET_CHARS)

  const lower = text.toLowerCase()
  const candidateStarts = new Set<number>([0])
  const maxCandidatesPerTerm = 25

  for (const term of terms) {
    let count = 0
    let idx = lower.indexOf(term)
    while (idx !== -1 && count < maxCandidatesPerTerm) {
      candidateStarts.add(Math.max(0, idx - Math.floor(DEFAULT_SNIPPET_CHARS / 3)))
      idx = lower.indexOf(term, idx + term.length)
      count += 1
    }
  }

  let bestStart = 0
  let bestScore = 0
  for (const start of candidateStarts) {
    const window = lower.slice(start, start + DEFAULT_SNIPPET_CHARS)
    const score = scoreWindow(window, terms)
    if (score > bestScore) {
      bestScore = score
      bestStart = start
    }
  }

  return truncateSnippet(text, bestScore > 0 ? bestStart : 0, DEFAULT_SNIPPET_CHARS)
}
