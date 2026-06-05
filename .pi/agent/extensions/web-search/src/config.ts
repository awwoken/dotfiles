import { DEFAULT_FETCH_CONTENT_CHARS, DEFAULT_MAX_RESULTS, MAX_FETCH_CONTENT_CHARS_LIMIT, MAX_RESULTS_LIMIT } from "./constants.ts"

export function clampMaxResults(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_MAX_RESULTS
  return Math.max(1, Math.min(MAX_RESULTS_LIMIT, Math.floor(value)))
}

export function clampMaxContentChars(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_FETCH_CONTENT_CHARS
  return Math.max(1, Math.min(MAX_FETCH_CONTENT_CHARS_LIMIT, Math.floor(value)))
}
