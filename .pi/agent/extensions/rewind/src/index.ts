import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent"
import type { UserMessage } from "@earendil-works/pi-ai"

type RewindTarget = {
  id: string
  text: string
}

function extractTextFromUserMessage(message: UserMessage): string {
  const { content } = message
  if (typeof content === "string") return content

  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
}

function findLastUserMessage(entries: SessionEntry[]): RewindTarget | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (entry.type !== "message") continue
    if (entry.message.role !== "user") continue

    const text = extractTextFromUserMessage(entry.message)
    if (!text.trim()) continue

    return { id: entry.id, text }
  }

  return undefined
}

export default function rewindExtension(pi: ExtensionAPI): void {
  pi.registerCommand("rewind", {
    description: "Cancel the current agent stream and edit the last user message",
    handler: async (_args, ctx) => {
      if (!ctx.isIdle()) {
        ctx.abort()
        await ctx.waitForIdle()
      }

      const target = findLastUserMessage(ctx.sessionManager.getBranch())
      if (!target) {
        ctx.ui.notify("No previous text user message found to rewind", "warning")
        return
      }

      const result = await ctx.navigateTree(target.id, { summarize: false })
      if (result.cancelled) {
        ctx.ui.notify("Rewind cancelled", "warning")
        return
      }

      ctx.ui.setEditorText(target.text)
      ctx.ui.notify("Rewound to last user message", "info")
    },
  })
}
