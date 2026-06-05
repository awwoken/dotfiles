# rtk

`rtk` rewrites selected Pi `bash` tool commands to use `rtk` equivalents for lower-token command output.

The extension is intentionally thin. It delegates rewrite decisions to the external `rtk rewrite` command, so the rewrite registry stays in `rtk` itself rather than in this Pi extension.

## Requirements

- `rtk` must be available in `PATH`.
- `rtk` must be version `0.23.0` or newer.

At startup, the extension runs:

```sh
rtk --version
```

If `rtk` is missing or too old, the extension logs a warning and disables itself.

If the version output cannot be parsed, the extension treats it as supported instead of disabling itself.

## Behavior

The extension listens for Pi `tool_call` events and only handles calls for the `bash` tool.

A command is skipped when:

- the tool call is not `bash`;
- the command is missing, not a string, or blank;
- the command already starts with `rtk `;
- `RTK_DISABLED=1` is set in the environment.

For eligible commands, the extension runs:

```sh
rtk rewrite <command>
```

with a 2000 ms timeout.

If `rtk rewrite` returns a replacement command, the extension mutates the pending bash command before Pi executes it.

## `rtk rewrite` exit-code contract

The extension relies on this contract:

- `0` with stdout — rewrite found; use stdout as the new command.
- `1` — no RTK equivalent; pass the original command through unchanged.
- `3` with stdout — advisory rewrite found; use stdout as the new command.

Any other exit code, empty stdout, timeout, or killed process causes the original command to pass through unchanged.

Unexpected handler errors are caught and logged, and the original command is allowed to continue.

## Disabling

Disable rewriting for a Pi process by setting:

```sh
RTK_DISABLED=1
```

This leaves the extension loaded but makes `shouldRewriteCommand` return `false` for every command.

## Implementation notes

- The extension is loaded through the root `index.ts` shim, which exports `src/index.ts` for Pi auto-discovery.
- `src/index.ts` performs startup version checks and registers the `tool_call` handler.
- `src/rewrite.ts` decides whether a bash command is eligible and invokes `rtk rewrite`.
- `src/version.ts` parses and compares semantic versions.
- Rewrite rules do not live here; update `rtk`'s own rewrite registry instead.

## Limitations

- Only rewrites Pi `bash` tool calls.
- Requires the external `rtk` binary.
- Rewrite and version checks are intentionally short-lived with a 2000 ms timeout.
- The extension does not expose a Pi tool or command.
- It silently passes through commands when no safe rewrite is produced.
