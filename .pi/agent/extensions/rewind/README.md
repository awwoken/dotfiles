# rewind

`rewind` adds a Pi command for quickly returning to a previous user message so you can edit and resend it.

It is a shortcut for the manual flow:

1. Press `Esc` to stop the current agent stream.
2. Open `/tree`.
3. Select the previous user message to restore.

## Command

### `/rewind [count]`

Cancels the current agent stream if one is running, then restores a previous text user message from the active branch into the editor. The optional `count` argument is a positive integer: `1` selects the latest text user message, `2` selects the text user message before that, and so on.

Behavior:

- aborts the active stream when Pi is not idle;
- waits until the agent is idle;
- finds the requested previous text user message on the current branch;
- navigates back to that message without creating a branch summary;
- puts the message text back into the editor for editing.

## Usage

```text
/rewind
/rewind 1
/rewind 2
```

`/rewind` and `/rewind 1` restore the latest text user message. `/rewind 2` restores the text user message before the latest one.

After running the command, edit the restored prompt and press `Enter` to send it again.

## Limitations

- Only text user messages are restored.
- Images or other non-text content from the original message are not restored into the editor.
- The command is implemented as a slash command, not a native keybinding.
