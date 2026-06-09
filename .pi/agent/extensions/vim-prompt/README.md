# vim-prompt

`vim-prompt` replaces Pi's local prompt editor with a lightweight Vim-style modal editor.

It is intended for editing the current prompt before submission. It does not affect files, shell input, tool output, or model responses.

## Command

### `/vim-prompt [on|off|toggle|status]`

Toggles the Vim prompt editor for the current Pi session.

- `on` — enables the custom Vim prompt editor.
- `off` — disables it and restores the previous editor component.
- `toggle` — switches between enabled and disabled. This is the default when no argument is provided.
- `status` — reports whether `vim-prompt` is currently enabled.

Invalid arguments show usage:

```text
Usage: /vim-prompt [on|off|toggle|status]
```

## Behavior

The extension installs itself on session startup and when Pi resources are discovered. When enabled, the prompt starts in insert mode and supports modal editing inside the prompt buffer.

The editor shows the active mode in the prompt border:

- `INSERT`
- `NORMAL`
- `VISUAL`
- `V-LINE`

The terminal cursor shape also changes by mode when supported by the terminal:

- insert mode — bar cursor;
- normal mode — block cursor;
- visual modes — underline cursor.

Cursor styling is reset when the extension is disabled or the session shuts down.

## Supported editing

`vim-prompt` implements a practical subset of Vim behavior for prompt editing.

Normal mode supports:

- motions: `h`, `j`, `k`, `l`, `0`, `^`, `$`, `w`, `b`, `e`, `gg`, `G`;
- insert entry: `i`, `a`, `I`, `A`, `o`, `O`;
- operators: `d`, `c`, `y`, `>`, `<` with supported motions;
- line operations: `dd`, `cc`, `yy`, `S`, `D`, `C`, `Y`, `J`;
- character operations: `x`, `s`, `r`, `f`, `F`, `t`, `T`, `;`, `,`;
- paste: `p`, `P`;
- undo/redo: `u`, `ctrl+r`;
- repeat last change: `.`;
- search: `/`, `n`, `N`;
- counts before supported commands and motions.

Visual mode supports:

- character visual mode with `v`;
- line visual mode with `V`;
- visual movement with the supported motions;
- `y`, `d`, `x`, `c`, `s`, `S`, `p`, `P`, `>`, `<`, `~`;
- `I` and `A` from visual-line mode.

Supported text objects include:

- `iw`, `aw`, `iW`, `aW`;
- quoted strings: `i'`, `a'`, `i"`, `a"`, `` i` ``, `` a` ``;
- delimited blocks for `()`, `[]`, `{}`, plus `b` for parentheses and `B` for braces.

## App key passthrough

Some Pi application-level keys are delegated to the normal prompt editor instead of being interpreted as Vim commands:

- `tab`
- `shift+tab`
- `shift+enter`
- `ctrl+l`
- `ctrl+t`

`enter`, `ctrl+c`, `ctrl+d`, and `ctrl+g` are also delegated so prompt submission and Pi-level controls continue to work.

## Implementation notes

- The extension is loaded through the root `index.ts` shim, which exports `src/index.ts` for Pi auto-discovery.
- `src/index.ts` registers the `/vim-prompt` command and installs the custom editor component.
- `src/vim-editor.ts` adapts Pi's `CustomEditor` to the modal editing engine and owns rendering/cursor styling.
- `src/engine.ts` implements modal state, Vim commands, registers, search, undo/redo, and repeat behavior.
- `src/buffer.ts`, `src/motions.ts`, and `src/text-objects.ts` hold prompt-buffer editing primitives.

## Limitations

- Interactive TUI only.
- This is a prompt-local Vim subset, not a full Vim implementation.
- Registers, undo/redo, search, and mode state are local to each prompt editor instance.
- Cursor shape changes are terminal-dependent and best-effort.
- Disabling the extension affects the current session; the extension installs enabled by default on startup.
