import { OLLAMA_HOST } from "./constants.ts"
import type { FetchResponse, SearchResponse } from "./types.ts"

async function assertOllamaResponse(response: Response, operation: string): Promise<void> {
  if (response.ok) return

  if (response.status === 401) {
    throw new Error("Unauthorized. Run `ollama signin` to authenticate.")
  }

  const errorText = await response.text().catch(() => "")
  throw new Error(`${operation} API error (status ${response.status}): ${errorText || response.statusText}`)
}

export async function searchOllama(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResponse> {
  const response = await fetch(`${OLLAMA_HOST}/api/experimental/web_search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: maxResults }),
    signal,
  })

  await assertOllamaResponse(response, "Search")

  return (await response.json()) as SearchResponse
}

export async function fetchOllama(url: string, signal?: AbortSignal): Promise<FetchResponse> {
  const response = await fetch(`${OLLAMA_HOST}/api/experimental/web_fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  })

  await assertOllamaResponse(response, "Fetch")

  return (await response.json()) as FetchResponse
}
