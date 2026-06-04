import { FETCH_LINKS_LIMIT } from "./constants.ts"
import { buildSnippet } from "./snippets.ts"
import { normalizeText } from "./text.ts"
import type { FetchResponse, SearchResult } from "./types.ts"

export function formatResults(results: SearchResult[], query: string): string {
  if (results.length === 0) return "No results found."

  return results
    .map((result, index) => {
      const title = normalizeText(result.title || "Untitled")
      const url = normalizeText(result.url || "")
      const snippet = buildSnippet(result, query)
      return [`${index + 1}. ${title}`, `   URL: ${url}`, snippet ? `   Snippet: ${snippet}` : undefined]
        .filter(Boolean)
        .join("\n")
    })
    .join("\n\n")
}

function normalizeContent(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content

  const truncated = content.slice(0, maxChars)
  const boundary = Math.max(truncated.lastIndexOf("\n"), truncated.lastIndexOf(" "))
  const body = boundary > Math.floor(maxChars * 0.8) ? truncated.slice(0, boundary) : truncated
  return `${body.trimEnd()}\n\n…truncated to ${maxChars} characters.`
}

export function formatFetchResult(result: FetchResponse, requestedUrl: string, maxContentChars: number): string {
  const title = normalizeText(result.title || "Untitled")
  const content = truncateContent(normalizeContent(result.content || ""), maxContentChars)
  const links = (result.links ?? []).slice(0, FETCH_LINKS_LIMIT).map((link) => normalizeText(link))
  const omittedLinks = Math.max((result.links?.length ?? 0) - links.length, 0)

  return [
    `Title: ${title}`,
    `URL: ${requestedUrl}`,
    content ? `\nContent:\n${content}` : "\nContent: No page content returned.",
    links.length > 0 ? `\nLinks:\n${links.map((link) => `- ${link}`).join("\n")}` : undefined,
    omittedLinks > 0 ? `…${omittedLinks} more links omitted.` : undefined,
  ]
    .filter(Boolean)
    .join("\n")
}
