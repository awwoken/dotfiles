# startup-summary

`startup-summary` shows a compact startup widget with counts for loaded Pi resources.

It is intended to pair with Pi's `quietStartup` setting so the built-in startup header stays hidden while still showing a small readiness summary.

Example:

```text
7 skills · 4 custom sources · 22 tools · 10 commands
```

## Behavior

On `session_start`, the extension renders a widget above the editor with counts for:

- skills available in the active system prompt;
- custom tool/command sources from extension or package metadata;
- configured tools;
- slash commands.

The widget is cleared on the first user input so it does not stay in the way.

## Settings

Enable quiet startup in Pi settings:

```json
{
  "quietStartup": true
}
```

This repository tracks that setting in `.pi/agent/settings.json`.

## Implementation notes

- The extension is loaded through the root `index.ts` shim, which exports `src/index.ts` for Pi auto-discovery.
- `src/index.ts` listens for `session_start` and `input` events.
- Tool and command counts use Pi extension runtime APIs.
- Skill count is derived from the active system prompt's `<available_skills>` block.

## Limitations

- Interactive TUI only.
- The custom source count is based on registered tool/command source metadata, not every loaded extension file.
- Extension-provided resources discovered after `session_start` may not be reflected until a later reload/startup cycle.
