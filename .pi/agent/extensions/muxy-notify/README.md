# muxy-notify

`muxy-notify` sends Pi notifications to Muxy through a Unix socket.

It is designed for environments where Pi is running inside a Muxy-managed pane and should notify the surrounding UI when Pi needs input or when an agent turn completes.

## Activation

The extension is disabled unless both environment variables are present:

- `MUXY_SOCKET_PATH` — Unix socket path to connect to.
- `MUXY_PANE_ID` — pane identifier included in notification payloads.

If either variable is missing, the extension returns during startup and registers no event behavior.

## Events

### `user_attention_needed`

The extension listens directly on `pi.events` for `user_attention_needed` events.

An event is accepted when it is an object with:

- `kind` — any string.
- `body` — notification body string.
- `title` — optional notification title.

The notification title defaults to:

```text
Pi needs input
```

This pairs with extensions such as `ask-question`, which emit `user_attention_needed` before opening an interactive prompt.

### `agent_end`

The extension also listens for Pi's `agent_end` lifecycle event.

On completion, it sends a notification with:

- title: `Pi`
- body: the latest assistant text from the completed event messages

If no assistant text can be extracted, the body falls back to:

```text
Session completed
```

Only text assistant content is used. Non-text content is ignored.

## Muxy payload format

Notifications are written to the socket as a pipe-delimited payload:

```text
pi|<pane-id>|<title>|<body>
```

Before sending, each title/body payload part is sanitized:

- newlines, carriage returns, and pipe characters are replaced with spaces;
- each part is truncated to 200 characters.

## Error behavior

Socket errors and connection errors are written to stderr with the extension name prefix:

```text
[muxy-pi] socket error: ...
[muxy-pi] connection error: ...
```

Notification failures do not throw back into Pi's agent flow.

Socket close waits are capped at 3000 ms. If the socket does not close in time, it is destroyed and the send operation resolves.

## Implementation notes

- The extension is loaded through the root `index.ts` shim, which exports `src/index.ts` for Pi auto-discovery.
- `src/index.ts` wires Pi events to notification sends.
- `src/muxy.ts` loads environment config, formats payloads, opens the Unix socket, and handles socket lifecycle.
- `src/pi-events.ts` validates Pi event shapes and extracts assistant completion text.
- `src/constants.ts` contains titles, truncation length, timeout, and extension name.

## Limitations

- Requires Muxy-specific environment variables.
- Uses a Unix socket path; it is not a cross-platform notification backend.
- Payload format is intentionally simple and pipe-delimited.
- Notification body is truncated to keep socket payloads compact.
- It does not retry failed notifications.
