import {
  keyHint,
  type AgentToolResult,
  type Theme,
  type ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent"
import { Text, type Component } from "@earendil-works/pi-tui"

import type { WebFetchDetails, WebSearchDetails } from "./types.ts"

interface WebSearchArgs {
  query?: string
  max_results?: number
}

interface WebFetchArgs {
  url?: string
  max_content_chars?: number
}

interface RenderContext {
  lastComponent?: Component
  isError?: boolean
}

function textComponent(context: RenderContext, text: string): Text {
  const component =
    context.lastComponent instanceof Text
      ? context.lastComponent
      : new Text("", 0, 0)
  component.setText(text)
  return component
}

function extractText(result: AgentToolResult<unknown>): string {
  return result.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n")
}

function truncateInline(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

function formatCount(value: number, unit: string): string {
  if (!Number.isFinite(value)) return `0 ${unit}`
  if (value < 1_000) return `${value} ${unit}`

  const rounded =
    value >= 10_000
      ? Math.round(value / 1_000).toString()
      : (value / 1_000).toFixed(1)
  return `${rounded.replace(/\.0$/, "")}k ${unit}`
}

function expandedText(
  result: AgentToolResult<unknown>,
  context: RenderContext,
): Text {
  return textComponent(context, extractText(result))
}

function errorText(
  result: AgentToolResult<unknown>,
  theme: Theme,
  context: RenderContext,
): Text {
  return textComponent(
    context,
    theme.fg("error", extractText(result) || "Tool failed."),
  )
}

function renderPending(theme: Theme, context: RenderContext): Text {
  return textComponent(context, theme.fg("warning", "Searching…"))
}

export function renderWebSearchCall(
  args: WebSearchArgs,
  theme: Theme,
  context: RenderContext,
): Text {
  const query = args.query
    ? quote(truncateInline(args.query, 96))
    : theme.fg("muted", "…")
  return textComponent(
    context,
    `${theme.fg("toolTitle", theme.bold("web_search"))} ${theme.fg("accent", query)}`,
  )
}

export function renderWebSearchResult(
  result: AgentToolResult<WebSearchDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
  context: RenderContext,
): Text {
  if (options.isPartial) return renderPending(theme, context)
  if (context.isError) return errorText(result, theme, context)
  if (options.expanded) return expandedText(result, context)

  const details = result.details
  const titles = details.results
    .map((item) => truncateInline(item.title || item.url, 42))
    .filter(Boolean)
  const visibleTitles = titles.slice(0, 3).join(", ")
  const omittedTitles = Math.max(titles.length - 3, 0)
  const titleSummary = visibleTitles
    ? `: ${visibleTitles}${omittedTitles > 0 ? "…" : ""}`
    : ""
  const hint = keyHint("app.tools.expand", "to expand")

  return textComponent(
    context,
    `${theme.fg("success", "✓")} ${details.resultCount} ${details.resultCount === 1 ? "result" : "results"}${theme.fg("dim", titleSummary)} ${theme.fg("muted", hint)}`,
  )
}

export function renderWebFetchCall(
  args: WebFetchArgs,
  theme: Theme,
  context: RenderContext,
): Text {
  const url = args.url ? truncateInline(args.url, 110) : "…"
  return textComponent(
    context,
    `${theme.fg("toolTitle", theme.bold("web_fetch"))} ${theme.fg("accent", url)}`,
  )
}

export function renderWebFetchResult(
  result: AgentToolResult<WebFetchDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
  context: RenderContext,
): Text {
  if (options.isPartial)
    return textComponent(context, theme.fg("warning", "Fetching…"))
  if (context.isError) return errorText(result, theme, context)
  if (options.expanded) return expandedText(result, context)

  const details = result.details
  const title = truncateInline(details.title || details.url || "Untitled", 72)
  const contentSummary = details.truncated
    ? `${formatCount(details.returnedContentChars, "chars")} of ${formatCount(details.contentChars, "chars")}`
    : formatCount(details.contentChars, "chars")
  const linkSummary = `${details.linkCount} ${details.linkCount === 1 ? "link" : "links"}`
  const hint = keyHint("app.tools.expand", "to expand")

  return textComponent(
    context,
    `${theme.fg("success", "✓ fetched")} ${theme.fg("dim", quote(title))} — ${contentSummary}, ${linkSummary} ${theme.fg("muted", hint)}`,
  )
}
