import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

import { fetchOllama, searchOllama } from "./client.ts"
import { clampMaxContentChars, clampMaxResults } from "./config.ts"
import { connectionRefusedError, isConnectionRefused } from "./errors.ts"
import { formatFetchResult, formatResults } from "./format.ts"
import {
  renderWebFetchCall,
  renderWebFetchResult,
  renderWebSearchCall,
  renderWebSearchResult,
} from "./render.ts"
import { WebFetchParams, WebSearchParams } from "./schema.ts"

export default function ollamaWebSearch(pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web for real-time information using local Ollama web_search, returning compact titles, URLs, and query-focused snippets.",
    promptSnippet:
      "Search the web and return compact titles, URLs, and query-focused snippets.",
    promptGuidelines: [
      "Use web_search for discovery; snippets are previews, not full source material.",
    ],
    parameters: WebSearchParams,
    renderCall: renderWebSearchCall,
    renderResult: renderWebSearchResult,
    async execute(_toolCallId, params, signal) {
      const maxResults = clampMaxResults(params.max_results)

      try {
        const data = await searchOllama(params.query, maxResults, signal)
        const results = (data.results ?? []).slice(0, maxResults)

        return {
          content: [
            {
              type: "text" as const,
              text: formatResults(results, params.query),
            },
          ],
          details: {
            resultCount: results.length,
            results: results.map((result) => ({
              title: result.title,
              url: result.url,
            })),
          },
        }
      } catch (error) {
        if (isConnectionRefused(error)) {
          throw connectionRefusedError()
        }
        throw error
      }
    },
  })

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch a single URL using local Ollama web_fetch, returning the extracted page title, main content, and links.",
    promptSnippet:
      "Fetch a single URL and return extracted page content plus links.",
    promptGuidelines: [
      "Use web_fetch for a specific URL; use web_search first when discovery is needed.",
      "Ollama web_fetch returns extracted page content, not guaranteed raw HTML.",
    ],
    parameters: WebFetchParams,
    renderCall: renderWebFetchCall,
    renderResult: renderWebFetchResult,
    async execute(_toolCallId, params, signal) {
      const maxContentChars = clampMaxContentChars(params.max_content_chars)

      try {
        const data = await fetchOllama(params.url, signal)

        const contentChars = data.content?.length ?? 0

        return {
          content: [
            {
              type: "text" as const,
              text: formatFetchResult(data, params.url, maxContentChars),
            },
          ],
          details: {
            title: data.title,
            url: params.url,
            contentChars,
            returnedContentChars: Math.min(contentChars, maxContentChars),
            linkCount: data.links?.length ?? 0,
            truncated: contentChars > maxContentChars,
          },
        }
      } catch (error) {
        if (isConnectionRefused(error)) {
          throw connectionRefusedError()
        }
        throw error
      }
    },
  })
}
