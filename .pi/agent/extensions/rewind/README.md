# rewind

`rewind` adds a Pi command for quickly returning to your last user message so you can edit and resend it.

It is a shortcut for the manual flow:

1. Press `Esc` to stop the current agent stream.
2. Open `/tree`.
3. Select the latest user message.

## Command

### `/rewind`

Cancels the current agent stream if one is running, then restores the latest text user message from the active branch into the editor.

Behavior:

- aborts the active stream when Pi is not idle;
- waits until the agent is idle;
- finds the latest text user message on the current branch;
- navigates back to that message without creating a branch summary;
- puts the message text back into the editor for editing.

## Usage

```text
/rewind
```

After running the command, edit the restored prompt and press `Enter` to send it again.

## Limitations

- Only text user messages are restored.
- Images or other non-text content from the original message are not restored into the editor.
- The command is implemented as a slash command, not a native keybinding.
