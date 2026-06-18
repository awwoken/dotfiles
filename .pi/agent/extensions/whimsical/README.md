# whimsical

`whimsical` customizes Pi's working message with a random whimsical status phrase during each agent turn.

## Behavior

- On `turn_start`, the extension picks a random phrase and calls `ctx.ui.setWorkingMessage(...)`.
- On `turn_end`, it resets the working message with `ctx.ui.setWorkingMessage()` so the next turn starts cleanly.

## Implementation notes

- `index.ts` exports `src/index.ts` for the tracked global extension layout used by this repository.
- `src/index.ts` contains the extension implementation.
