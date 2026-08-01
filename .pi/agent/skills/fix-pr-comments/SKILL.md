---
name: fix-pr-comments
description: >-
  Use when the user asks to fix, address, or resolve unresolved GitHub pull request review
  comments or review threads.
---

# Fix PR Comments

## Requirements

- `gh` must be installed and authenticated.
- Run GitHub commands from the repository being reviewed so `gh` can infer the repository.
- The review-thread scripts are located relative to this skill. In this global configuration, invoke them from:
  `$HOME/.pi/agent/skills/fix-pr-comments/scripts/`.
- If this skill is loaded from another location, resolve scripts relative to the directory containing this `SKILL.md` and invoke them with absolute paths. Do not resolve them relative to the current working directory.

Each focused script emits compact JSON:

```bash
node "$HOME/.pi/agent/skills/fix-pr-comments/scripts/list-review-threads.mjs" --pr <number> --status unresolved --outdated current
node "$HOME/.pi/agent/skills/fix-pr-comments/scripts/reply-review-thread.mjs" --thread-id <thread-id> --body "Fixed in <sha>."
node "$HOME/.pi/agent/skills/fix-pr-comments/scripts/react-review-comment.mjs" --subject-id <comment-id> --reaction THUMBS_UP
node "$HOME/.pi/agent/skills/fix-pr-comments/scripts/resolve-review-thread.mjs" --thread-id <thread-id>
```

Use `Thread ID` values for reply/resolve operations and `Comment ID` values for reactions.

## Workflow

1. Identify the pull request number. When it is not supplied, use `gh pr view --json number,url,headRefName,baseRefName`.
2. Fetch the PR's unresolved, current review threads before making changes:

   ```bash
   node "$HOME/.pi/agent/skills/fix-pr-comments/scripts/list-review-threads.mjs" --pr <number> --status unresolved --outdated current
   ```

3. For each thread, explicitly assess whether the comment is valid:
   - State the comment's claim.
   - Compare it against the code and intended behavior.
   - Decide whether it is valid.
4. If a comment does not seem valid:
   - Do not edit, commit, push, comment on, or resolve that thread.
   - Notify the user with the assessment and evidence.
   - Continue only with other threads that are valid.
5. If no comments seem valid, stop after notifying the user.
6. For valid comments:
   - Fix each issue with the smallest appropriate change.
   - Verify the fix with the relevant test, typecheck, lint, or targeted manual check.
   - Use `gh pr checks <number>` when current PR check status is relevant.
   - Commit and push only when the user's latest request explicitly authorizes those Git state changes; otherwise stop after verification and ask for permission.
   - After the verified fix is pushed, reply on each fixed review thread referencing the fix commit by short SHA or commit URL.
   - Run review-thread reply mutations sequentially, one at a time. Never place multiple `reply-review-thread.mjs` calls in a parallel tool group; concurrent replies can race in GitHub and leave an orphaned pending review comment.
   - Resolve each fixed review thread only after its reply succeeds and the helper confirms the reply belongs to a submitted review.
   - Explain to the user what the issue was and how it was fixed.
7. For bot comments that explicitly accept reactions as an assessment signal, such as "Useful? React with 👍 / 👎.":
   - React `THUMBS_UP` when the comment was useful or valid.
   - React `THUMBS_DOWN` when the comment was assessed as not valid.
   - Add the reaction before resolving any fixed thread.

## Review Thread Replies

Keep review thread replies concise and closure-focused. Include:

- A clear statement that the issue was fixed.
- The fix commit as a short SHA or commit URL.
- Optionally, a brief mention of the changed area when it helps the reviewer.

Do not put the full issue analysis, implementation details, or verification summary in the thread reply; explain those to the user instead.

Good examples:

- `Fixed in 3f4a91c.`
- `Fixed in 3f4a91c by tightening the null check before rendering the value.`

Keep the scope limited to the reviewed issues. Do not resolve a thread unless its fix is verified and pushed.

`reply-review-thread.mjs` verifies that GitHub attached the new reply to a submitted review. If GitHub instead creates an orphaned or pending reply, the helper deletes it and exits with an error. Wait for any other reply call to finish, then retry that thread individually before resolving it.
