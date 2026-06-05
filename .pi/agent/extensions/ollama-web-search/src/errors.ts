import { OLLAMA_HOST } from "./constants.ts"

export function isConnectionRefused(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause
  return error.message.includes("ECONNREFUSED") || cause?.code === "ECONNREFUSED" || cause?.message?.includes("ECONNREFUSED") === true
}

export function connectionRefusedError(): Error {
  return new Error(`Could not connect to Ollama at ${OLLAMA_HOST}. Make sure Ollama is running and web search/fetch is enabled.`)
}
