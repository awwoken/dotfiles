---
name: fix-pr-comments
description: >-
  Use when the user asks to fix, address, or resolve unresolved GitHub pull request review
  comments or review threads.
---

## Workflow

1. Fetch the PR's unresolved, current review threads before making changes.
2. For each thread, explicitly assess whether the comment is valid:
   - State the comment's claim.
   - Compare it against the code and intended behavior.
   - Decide whether it is valid.
3. If a comment does not seem valid:
   - Do not edit, commit, push, comment on, or resolve that thread.
   - Notify the user with the assessment and evidence.
   - Continue only with other threads that are valid.
4. If no comments seem valid, stop after notifying the user.
5. For valid comments:
   - Fix each issue with the smallest appropriate change.
   - Verify the fix with the relevant test, typecheck, lint, or targeted manual check.
   - Commit and push only when the user's latest request explicitly authorizes those Git state changes; otherwise stop after verification and ask for permission.
   - Reply on each fixed review thread referencing the fix commit by short SHA or commit URL.
   - Resolve each fixed review thread.
   - Explain to the user what the issue was and how it was fixed.
6. For bot comments that explicitly accept reactions as an assessment signal, such as "Useful? React with 👍 / 👎.":
   - React 👍 when the comment was useful or valid.
   - React 👎 when the comment was assessed as not valid.
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
