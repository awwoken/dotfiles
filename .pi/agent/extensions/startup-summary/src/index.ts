import type { ExtensionAPI, SourceInfo, ToolInfo } from "@earendil-works/pi-coding-agent"

const WIDGET_KEY = "startup-summary"

export default function startupSummaryExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (event, ctx) => {
    if (ctx.mode !== "tui") return

    const summary = buildStartupSummary(pi, ctx.getSystemPrompt())

    ctx.ui.setWidget(WIDGET_KEY, [summary], { placement: "aboveEditor" })
  })

  pi.on("input", async (_event, ctx) => {
    if (ctx.mode !== "tui") return
    ctx.ui.setWidget(WIDGET_KEY, undefined)
  })
}

function buildStartupSummary(pi: ExtensionAPI, systemPrompt: string): string {
  const allTools = safeGet(() => pi.getAllTools(), [] as ToolInfo[])
  const commands = safeGet(() => pi.getCommands(), [])
  const skills = countAvailableSkills(systemPrompt)
  const customSources = countCustomSources(allTools, commands)

  return [
    plural(skills, "skill"),
    plural(customSources, "custom source"),
    plural(allTools.length, "tool"),
    plural(commands.length, "command"),
  ].join(" · ")
}

function countAvailableSkills(systemPrompt: string): number {
  const match = systemPrompt.match(/<available_skills>[\s\S]*?<\/available_skills>/)
  if (!match) return 0
  return [...match[0].matchAll(/<skill>/g)].length
}

function countCustomSources(tools: ToolInfo[], commands: Array<{ sourceInfo: SourceInfo }>): number {
  const sources = new Set<string>()

  for (const tool of tools) {
    addCustomSource(sources, tool.sourceInfo)
  }

  for (const command of commands) {
    addCustomSource(sources, command.sourceInfo)
  }

  return sources.size
}

function addCustomSource(sources: Set<string>, sourceInfo: SourceInfo | undefined): void {
  if (!sourceInfo) return
  if (sourceInfo.source === "builtin") return
  if (!sourceInfo.source.startsWith("extension:") && sourceInfo.origin !== "package") return

  sources.add(sourceInfo.baseDir ?? sourceInfo.path ?? sourceInfo.source)
}

function plural(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`
}

function safeGet<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}
