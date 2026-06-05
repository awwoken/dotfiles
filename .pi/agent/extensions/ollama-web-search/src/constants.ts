export const OLLAMA_HOST = "http://localhost:11434"

export const DEFAULT_MAX_RESULTS = 5
export const MAX_RESULTS_LIMIT = 8
export const DEFAULT_SNIPPET_CHARS = 240

export const DEFAULT_FETCH_CONTENT_CHARS = 12_000
export const MAX_FETCH_CONTENT_CHARS_LIMIT = 30_000
export const FETCH_LINKS_LIMIT = 20

export const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "what",
  "when",
  "where",
  "with",
])
