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

function findNthPreviousUserMessage(entries: SessionEntry[], count: number): RewindTarget | undefined {
  let matches = 0

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (entry.type !== "message") continue
    if (entry.message.role !== "user") continue

    const text = extractTextFromUserMessage(entry.message)
    if (!text.trim()) continue

    matches += 1
    if (matches === count) return { id: entry.id, text }
  }

  return undefined
}

function parseRewindCount(args: string): number | undefined {
  const value = args.trim()
  if (!value) return 1
  if (!/^\d+$/.test(value)) return undefined

  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 1) return undefined

  return count
}

export default function rewindExtension(pi: ExtensionAPI): void {
  pi.registerCommand("rewind", {
    description: "Cancel the current agent stream and edit a previous user message",
    handler: async (args, ctx) => {
      const count = parseRewindCount(args)
      if (!count) {
        ctx.ui.notify("Usage: /rewind [positive-message-count]", "warning")
        return
      }

      if (!ctx.isIdle()) {
        ctx.abort()
        await ctx.waitForIdle()
      }

      const target = findNthPreviousUserMessage(ctx.sessionManager.getBranch(), count)
      if (!target) {
        ctx.ui.notify(`No text user message found ${count} message${count === 1 ? "" : "s"} back to rewind`, "warning")
        return
      }

      const result = await ctx.navigateTree(target.id, { summarize: false })
      if (result.cancelled) {
        ctx.ui.notify("Rewind cancelled", "warning")
        return
      }

      ctx.ui.setEditorText(target.text)
      ctx.ui.notify(`Rewound to previous user message #${count}`, "info")
    },
  })
}
