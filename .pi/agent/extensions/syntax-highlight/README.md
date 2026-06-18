# syntax-highlight

Local Pi extension for syntax-highlighted `edit`/`write` diffs and bash command call lines.

## Behavior

- Overrides Pi built-in `edit`, `write`, and optionally `bash` renderers.
- Delegates actual file mutation and command execution to Pi's built-in tools.
- Renders syntax-highlighted split/unified diffs for `edit` and `write` results.
- Shows pending edit/write previews while tool arguments are still streaming when a safe workspace-local preview can be computed.
- Syntax-highlights bash command call lines while leaving bash output, including collapsed muted previews, to Pi's built-in renderer.
- Uses full-file before/after highlighting context when available, so partial diff hunks preserve multi-line syntax state more accurately.
- Falls back to per-line highlighting when full-file context is unavailable or too large.

## Command

```text
/syntax-highlight
/syntax-highlight show
/syntax-highlight reset
```

## Source layout

```text
src/
  config/  Settings storage and validation.
  diff/    Diff parsing, syntax highlighting, layouts, previews, and width safety.
  shared/  Shared config/types.
  tools/   Focused edit/write/bash tool override delegation.
  utils/   Generic path, ANSI, object, lifecycle, and render helpers.
```

## Config

Runtime config is read from Pi's settings file under the `syntaxHighlight` key:

```text
~/.pi/agent/settings.json#syntaxHighlight
```

In this dotfiles repo, edit the tracked settings file instead:

```text
.pi/agent/settings.json
```

Example:

```json
{
  "syntaxHighlight": {
    "registerToolOverrides": {
      "bash": true,
      "edit": true,
      "write": true
    },
    "diffViewMode": "auto",
    "diffCollapsedLines": 24,
    "diffWordWrap": true
  }
}
```
