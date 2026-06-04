# btw

`btw` adds a lightweight side-chat to Pi for follow-up questions that should not pollute the main conversation thread.

Side-chat turns are stored as Pi custom entries, so they are available to the extension but are not added to the main agent context.

## Commands

### `/btw <message>`

Starts a new active btw chat and immediately asks the message.

- Creates a fresh side chat every time.
- Replaces any previously active btw chat.
- If another btw response is currently running, it is aborted and saved before the new chat starts.
- Uses the currently available main-thread context at the time the command runs.

### `/also <message>`

Sends a follow-up into the currently active btw chat.

- Requires an active btw chat.
- Uses the current main-thread context plus successful prior turns from the active btw chat.
- Uses the model and thinking level from the original `/btw` that created the chat.
- If a btw response is already running, `/also` warns and does nothing.

### `/unbtw`

Stops the active btw chat.

- Hides the widget.
- Deactivates the current btw chat.
- If a btw response is streaming, it is aborted and saved as aborted.

### `/about`

Lists btw chats on the current branch.

- Selecting a chat opens its full transcript.
- The viewed chat becomes the active btw chat.
- The widget updates to that chat's latest turn.

## Widget

When a btw chat is active, a compact widget appears above the input area.

It shows:

- btw status in the top border line;
- model, thinking level, and controls in the border line;
- the latest side-chat prompt;
- a short preview of the latest answer.

Use `ctrl+shift+b` to toggle expanded mode by default. Expanded mode shows the full latest prompt and full latest answer.

Configure the shortcut in Pi `settings.json`:

```json
{
  "btw": {
    "toggleShortcut": "ctrl+shift+b"
  }
}
```

Project settings (`.pi/settings.json`) override global settings (`~/.pi/agent/settings.json`). If unset, btw falls back to `ctrl+shift+b`. Reload Pi after changing the setting.

While waiting for model output, the widget shows an animated loader: `. → .. → ...`.

## Context behavior

`btw` is intentionally side-channel only.

- Normal user messages still go to the main thread.
- Active btw chats do not block main-thread messages.
- btw entries are stored as custom entries and do not participate in the main agent context.
- `/also` sees only successful prior turns from the active btw chat, not other btw chats.
- Error and aborted turns are saved for history but are not used as future `/also` context.

If `/btw` or `/also` runs while the main agent is streaming, the side chat starts immediately with the currently saved main-thread context. The in-progress streamed assistant message is not included.

## Persistence

btw chats are scoped to the current session branch.

The active btw state is persisted, so reload/resume can restore the active chat and widget. `/unbtw` persists deactivation.

## Limitations

- Interactive UI only.
- Answer-only side chat: no tools are available inside btw responses.
- `/also` and `/unbtw` are always registered commands, but they are guarded and warn if no active btw exists.
- If the frozen original model for a chat is unavailable later, `/also` fails clearly instead of falling back to the current model.
