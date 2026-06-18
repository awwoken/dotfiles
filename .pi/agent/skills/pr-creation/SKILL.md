---
name: pr-creation
description: Use whenever the user asks to create, open, draft, publish, or prepare a GitHub pull request. Ensures PRs default to draft unless the user explicitly asks for an active/ready PR, and keeps titles and descriptions clear.
---

# PR Creation

Use this skill when the user asks to create, open, draft, publish, or prepare a GitHub pull request.

## Core Rule

Always create a **draft PR** by default.

Only create an active, ready-for-review PR when the user explicitly asks for it with wording such as:

- "create an active PR"
- "open it ready for review"
- "publish the PR"
- "not a draft"

If the user does not specify draft vs active, use draft.

## Before Creating the PR

1. Inspect the current branch and relevant Git state.
2. Confirm the intended base branch when it is not obvious.
3. Do not mutate Git state unless the user explicitly asked for that Git action.
4. If required information is missing, ask before creating the PR.

## PR Title

Write a concise, human-readable title that describes the user-visible intent of the change.

Prefer:

- imperative or noun-phrase style
- specific scope
- no trailing period
- no vague titles such as "Update code", "Fix stuff", or "Changes"

Examples:

- `Add npm package exposure and shim repair`
- `Fix agent skill loading for nested configs`
- `Document PR creation defaults`

## PR Description

Keep the description simple and useful. Include only sections that are supported by the actual work.

Recommended structure:

```markdown
## Summary
- what changed
- why it changed

## Validation
- command or check that passed
- command or check that was skipped, with reason
```

When passing the PR body to a CLI such as `gh pr create --body`, use **actual newlines** in the body text. Do not use escaped `\n` sequences as a substitute for line breaks.

Prefer a multiline body value, a temporary body file, or another shell-safe method that preserves real newlines.

## GitHub CLI Default

For a normal PR creation request, prefer:

```sh
gh pr create --draft --base <base-branch> --head <current-branch> --title "<title>" --body "<multiline body with real newlines>"
```

For an explicitly active PR request, omit `--draft`.
