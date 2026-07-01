---
name: commit-changes
description: Use whenever the user asks to commit, create commits, commit changes, or commit all unstaged/uncommitted work. Ensures changes are split into focused human-style commits instead of one broad commit when the work is not directly related.
---

# Commit Changes

When the user asks to commit changes, treat commit creation as a small review and grouping task, not as a blind `git add . && git commit`.

## Core Rule

If the user asks simply to “commit” or “commit everything”, do **not** put unrelated or unfocused changes into one commit. Create multiple focused commits that read like a human developed the work step by step.

A change can be “related” and still be too broad for one commit. Split work by reviewable intent and project boundary rather than by convenience or by the user's broad task name. The right boundaries depend on the repository: a library, CLI, dotfiles repo, infrastructure repo, backend service, mobile app, documentation site, and fullstack app all have different natural layers.

## Workflow

1. Inspect the current Git state before staging:
   - `git status --short`
   - `git diff --stat`
   - `git diff`
   - `git diff --cached` when staged changes exist
2. Identify logical groups by intent, not by convenience. Common groups include:
   - source behavior changes
   - public API or interface changes
   - internal refactors with no intended behavior change
   - tests, fixtures, snapshots, or test utilities
   - documentation, examples, prompts, guides, or plans
   - configuration, tooling, editor, shell, CI, or build-system changes
   - dependency, package, lockfile, or generated artifact changes
   - infrastructure, deployment, environment, or operations changes
   - data, assets, schemas, migrations, or content changes
   - cleanup, removals, renames, or dead-code deletion
   - formatting-only churn, only if it is truly separate
3. Adapt grouping to the current project’s structure:
   - CLI: argument parsing, command execution, output formatting, config loading, tests, docs.
   - Library/package: public API, internal implementation, types, tests, docs/examples, build metadata.
   - Backend/service: data model, service behavior, API boundary, jobs/workers, tests, docs/ops.
   - Frontend/mobile: data access, state/model logic, UI rendering, styling/assets, tests, copy/i18n.
   - Infrastructure: reusable modules, environment wiring, generated plans/state-adjacent artifacts, docs.
   - Dotfiles/config: shell, editor, terminal, window manager, agent config, scripts, docs.
4. Stage only one logical group at a time.
   - Prefer explicit path staging.
   - Use patch staging when one file contains unrelated changes and the split is safe.
   - Ask before committing if a safe split is unclear.
5. Before committing a staged group, review `git diff --cached --stat` and, when the group is non-trivial, `git diff --cached`. If the staged set includes multiple separable intentions or project boundaries from the lists above, stop and split it further.
6. Commit each group with a concise message describing the intent.
7. Verify the final state with `git status --short` and summarize the commits created.

## Guardrails

- Do not modify file contents while committing unless the user explicitly asks for fixes too.
- Do not collapse unrelated work into a vague commit such as “update config” or “misc changes”.
- Do not create a single broad commit named after the overall task when the staged diff contains separable behavior, tests, docs, tooling, dependencies, generated artifacts, config, infrastructure, assets, cleanup, or formatting changes.
- Do not include ignored/generated/dependency/cache files unless the user explicitly requested them or they are clearly intentional source changes.
- Keep generated files or lockfiles with the source change that requires them when they are mechanically tied to that change; otherwise commit them separately or ask.
- If existing staged changes are present, preserve the user’s staging intent only when the staged set is already focused. A broad staged set is not permission to commit it as-is; if the user asked to commit all/current work, unstage and regroup it, or ask before regrouping if staging intent is ambiguous.
