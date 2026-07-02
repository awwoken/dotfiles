# codex-fast

`codex-fast` toggles OpenAI Codex priority service tier support for Pi.

The extension patches provider request payloads with `service_tier: "priority"` through Pi's `before_provider_request` hook instead of overriding providers.

## Commands

### `/codex-fast`

Toggles fast mode on or off.

When enabled, the status bar shows:

- `fast` when the active model supports priority service tier;
- `fast (inactive)` when fast mode is enabled but the active model is not supported.

## CLI flag

Start Pi with fast mode enabled for the session:

```sh
pi --fast
```

## Supported models

Priority service tier is applied only for:

- `openai-codex/gpt-5.4`
- `openai-codex/gpt-5.5`

Other provider requests are left unchanged.

## Persistence

The enabled state is read from merged Pi settings:

- global: `$PI_CODING_AGENT_DIR/settings.json`, or Pi's agent directory when the environment variable is unset;
- project: `<cwd>/.pi/settings.json`.

The setting key is:

```json
{
  "pi-codex-fast": {
    "enabled": true
  }
}
```

Writes go to the global settings file.

## Implementation notes

- The extension is loaded through the root `index.ts` shim, which exports `src/index.ts` for Pi auto-discovery.
- `src/index.ts` registers the command, flag, lifecycle hooks, and provider request hook.
- `src/state.ts` owns fast-mode state, reload/toggle behavior, and queued persistence.
- `src/ui.ts` owns status bar updates and user notifications.
- `src/priority.ts` owns supported-model detection and provider payload patching.
- `src/settings.ts` handles global/project settings loading and global persistence.
