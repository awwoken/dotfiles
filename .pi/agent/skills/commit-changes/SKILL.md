---
name: commit-changes
description: Use whenever the user asks to commit, create commits, commit changes, or commit all unstaged/uncommitted work. Ensures changes are split into focused human-style commits instead of one broad commit when the work is not directly related.
---

# Commit Changes

When the user asks to commit changes, treat commit creation as a small review and grouping task, not as a blind `git add . && git commit`.

## Core Rule

If the user asks simply to “commit”, “commit everything”, or “commit all changes”, do **not** put unrelated or unfocused changes into one commit. Create multiple focused commits that read like a human developed the work step by step.

Words such as “all”, “everything”, and “current” define the **scope of changes to include**, not the number of commits to create. Include all eligible changes, but partition them into as many focused commits as their distinct intents require. Create one ordinary commit only when the user explicitly requests a single commit or when all included changes genuinely form one reviewable intent. In-progress merge commits are the special case described below.

A change can be “related” and still be too broad for one commit. Split work by reviewable intent and project boundary rather than by convenience or by the user's broad task name. The right boundaries depend on the repository: a library, CLI, dotfiles repo, infrastructure repo, backend service, mobile app, documentation site, and fullstack app all have different natural layers.

## Commit Message Convention

Investigate the repository's commit-message convention before creating commits:

1. Read explicit repository guidance first, including `AGENTS.md`, `CONTRIBUTING.md`, contributor documentation, commit templates, commitlint configuration, release tooling, and relevant package scripts.
2. Inspect a representative sample of recent history, such as `git log -20 --format='%s'`, to identify the dominant human-written subject and body style. Exclude automated dependency updates, release commits, reverts, and merge commits when they are not representative.
3. Follow explicit repository instructions over observed history. Otherwise, follow a clear and consistent convention in recent history.
4. If no convention can be established, fall back to Conventional Commits: `type(scope): imperative summary`. Omit the scope when it adds no useful context. Use an appropriate standard type such as `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`, `ci`, `perf`, or `style`.
5. Keep subjects concise and describe intent rather than implementation trivia. Add a body when motivation, migration impact, non-obvious tradeoffs, or conflict resolutions need explanation.

Do not force Conventional Commits onto a repository with a different established style. Merge commits may use the repository's merge-subject convention while still following the conflict-resolution body requirements below.

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
6. Commit each group with a concise message describing the intent and following the convention established above.
7. Verify the final state with `git status --short` and summarize the commits created.

## Merge Commits

Treat an in-progress Git merge as an intentional exception to ordinary commit splitting:

- Confirm the merge state with `git status` and the presence of unresolved or resolved conflict paths.
- Resolve and stage the complete merge as **exactly one merge commit**. Do not turn individual conflict resolutions into separate ordinary commits; the merge topology requires one commit with both parents. Resume normal intent-based splitting only for unrelated work after the merge is complete.
- Review every conflicted path before committing. If a path contains multiple materially different conflict decisions, account for each decision.
- Use a merge-appropriate subject and include a `Conflict resolutions:` section in the commit body whenever conflicts occurred.
- Add one bullet per conflicted path. Each bullet must explain what was kept, adopted, regenerated, or combined and why that resolution preserves the intended behavior. Do not write empty descriptions such as “resolved conflict”.
- If the rationale for a resolution is unclear, ask the user rather than inventing an explanation.

Example merge commit message:

```text
Merge branch 'feature/session-auth'

Conflict resolutions:
- src/auth/session.ts: kept the target branch's expiry validation while adopting the feature branch's token rotation so existing security checks remain intact.
- package-lock.json: regenerated from the merged package manifest to reflect both dependency sets consistently.
```

## Guardrails

- Do not modify file contents while committing unless the user explicitly asks for fixes too.
- Do not collapse unrelated work into a vague commit such as “update config” or “misc changes”.
- Do not create a single broad commit named after the overall task when the staged diff contains separable behavior, tests, docs, tooling, dependencies, generated artifacts, config, infrastructure, assets, cleanup, or formatting changes.
- Do not include ignored/generated/dependency/cache files unless the user explicitly requested them or they are clearly intentional source changes.
- Keep generated files or lockfiles with the source change that requires them when they are mechanically tied to that change; otherwise commit them separately or ask.
- If existing staged changes are present, preserve the user’s staging intent only when the staged set is already focused. A broad staged set is not permission to commit it as-is; if the user asked to commit all/current work, unstage and regroup it, or ask before regrouping if staging intent is ambiguous.
