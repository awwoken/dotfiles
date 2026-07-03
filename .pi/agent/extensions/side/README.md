# side

`side` adds a lightweight side-chat to Pi for follow-up questions that should not pollute the main conversation thread.

Side-chat turns are stored as Pi custom entries, so they are available to the extension but are not added to the main agent context.

## Commands

### `/side <message>`

Starts a new active side chat and immediately asks the message.

- Creates a fresh side chat every time.
- Replaces any previously active side chat.
- If another side response is currently running, it is aborted and saved before the new chat starts.
- Uses the currently available main-thread context at the time the command runs.

### `/also <message>`

Sends a follow-up into the currently active side chat.

- Requires an active side chat.
- Uses the current main-thread context plus successful prior turns from the active side chat.
- Uses the model and thinking level from the original `/side` that created the chat.
- If a side response is already running, `/also` warns and does nothing.

### `/unside`

Stops the active side chat.

- Hides the widget.
- Deactivates the current side chat.
- If a side response is streaming, it is aborted and saved as aborted.

### `/about`

Lists side chats on the current branch.

- Selecting a chat opens its full transcript.
- The viewed chat becomes the active side chat.
- The widget updates to that chat's latest turn.

## Widget

When a side chat is active, a compact widget appears above the input area.

It shows:

- side status in the top border line;
- model, thinking level, and controls in the border line;
- the latest side-chat prompt;
- a short preview of the latest answer.

Use `ctrl+shift+b` to toggle expanded mode by default. Expanded mode shows the full latest prompt and full latest answer.

Configure the shortcut in Pi `settings.json`:

```json
{
	"side": {
		"toggleShortcut": "ctrl+shift+b"
	}
}
```

Project settings (`.pi/settings.json`) override global settings (`~/.pi/agent/settings.json`). If unset, side falls back to `ctrl+shift+b`. Reload Pi after changing the setting.

While waiting for model output, the widget shows an animated loader: `. → .. → ...`.

## Context behavior

`side` is intentionally side-channel only.

- Normal user messages still go to the main thread.
- Active side chats do not block main-thread messages.
- side entries are stored as custom entries and do not participate in the main agent context.
- `/also` sees only successful prior turns from the active side chat, not other side chats.
- Error and aborted turns are saved for history but are not used as future `/also` context.

If `/side` or `/also` runs while the main agent is streaming, the side chat starts immediately with the currently saved main-thread context. The in-progress streamed assistant message is not included.

## Persistence

side chats are scoped to the current session branch.

The active side state is persisted, so reload/resume can restore the active chat and widget. `/unside` persists deactivation.

## Limitations

- Interactive UI only.
- Answer-only side chat: no tools are available inside side responses.
- `/also` and `/unside` are always registered commands, but they are guarded and warn if no active side chat exists.
- If the frozen original model for a chat is unavailable later, `/also` fails clearly instead of falling back to the current model.
