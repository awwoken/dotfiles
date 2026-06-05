# ask-question

`ask-question` adds a Pi tool for asking the user one interactive question with suggested choices and a free-form answer path.

It is intended for real user decisions, preferences, or confirmations that cannot be safely inferred from files, commands, documentation, or local context.

## Tool

### `ask-question`

Asks the user a question in Pi's interactive TUI.

Parameters:

- `question` — the question to show the user.
- `options` — suggested answers to display.

Each option supports:

- `label` — display text and selected answer value.
- `description` — optional explanatory text below the label.
- `isRecommended` — optional marker shown as `(recommended)` in the UI.

The tool prompt guidance expects exactly one suggested option to be marked as recommended, but the implementation does not enforce that at runtime.

## Interaction behavior

The UI always appends one extra free-form option:

```text
Type something.
```

Keyboard controls:

- `↑` / `↓` or `k` / `j` — move through options.
- `Enter` — select the current option.
- `Esc` — cancel.
- When typing a custom answer, `Enter` submits and `Esc` returns to option selection.

If the user selects a suggested option, the tool returns:

```text
User selected: <index>. <answer>
```

If the user types a custom answer, the tool returns:

```text
User wrote: <answer>
```

If the user cancels, the tool returns:

```text
User cancelled the selection
```

## User attention event

When Pi has an interactive UI and at least one option is provided, the extension emits a `user_attention_needed` event before showing the dialog:

```ts
{
  kind: "question",
  title: "Pi asks",
  body: params.question,
}
```

Other extensions, such as notification integrations, can listen for that event.

## Error behavior

The tool returns an error-style text result when:

- Pi is running without interactive UI: `Error: UI not available (running in non-interactive mode)`
- no options are provided: `Error: No options provided`

In both cases, the structured details include the original question, option labels, and `answer: null`.

## Rendering

The extension provides custom tool-call and tool-result renderers:

- tool calls show the question and numbered options, including the free-form option;
- recommended options are marked as `(recommended)`;
- selected answers render with a success check;
- custom answers render with a `(wrote)` marker;
- cancellations render as `Cancelled`.

## Implementation notes

- The extension is loaded through the root `index.ts` shim, which exports `src/index.ts` for Pi auto-discovery.
- `src/index.ts` registers the Pi tool and custom renderers.
- `src/schema.ts` defines the TypeBox input schema.
- `src/tool.ts` owns tool execution and structured result details.
- `src/ui.ts` owns the interactive custom TUI dialog.
- `src/render.ts` owns compact TUI rendering for calls and results.

## Limitations

- Requires interactive Pi UI for the actual dialog.
- Always asks exactly one question per tool call.
- Free-form answers are plain text only.
- Runtime validation does not enforce exactly one recommended option.
