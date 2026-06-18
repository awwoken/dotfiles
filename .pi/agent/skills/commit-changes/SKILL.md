---
name: commit-changes
description: Use whenever the user asks to commit, create commits, commit changes, or commit all unstaged/uncommitted work. Ensures changes are split into focused human-style commits instead of one broad commit when the work is not directly related.
---

# Commit Changes

When the user asks to commit changes, treat commit creation as a small review and grouping task, not as a blind `git add . && git commit`.

## Core Rule

If the user asks simply to “commit” or “commit everything”, do **not** put unrelated or unfocused changes into one commit. Create multiple focused commits that read like a human developed the work step by step.

## Workflow

1. Inspect the current Git state before staging:
   - `git status --short`
   - `git diff --stat`
   - `git diff`
   - `git diff --cached` when staged changes exist
2. Identify logical groups by intent, not by convenience:
   - feature/config additions
   - behavior changes
   - cleanup/removals
   - formatting or generated churn only if it is truly separate
3. Stage only one logical group at a time.
   - Prefer explicit path staging.
   - Use patch staging when one file contains unrelated changes and the split is safe.
   - Ask before committing if a safe split is unclear.
4. Commit each group with a concise message describing the intent.
5. Verify the final state with `git status --short` and summarize the commits created.

## Guardrails

- Do not modify file contents while committing unless the user explicitly asks for fixes too.
- Do not collapse unrelated work into a vague commit such as “update config” or “misc changes”.
- Do not include ignored/generated/dependency/cache files unless the user explicitly requested them or they are clearly intentional source changes.
- If existing staged changes are present, preserve the user’s staging intent unless the user explicitly asked to regroup everything.
