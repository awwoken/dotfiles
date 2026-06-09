# GitHub Pi extension

Reusable GitHub tools for Pi, backed by the GitHub CLI (`gh`). The extension is intentionally named `github` rather than `github-pr` so it can grow beyond pull-request workflows later.

## Goals

- Wrap common GitHub pull-request actions in Pi-native tools.
- Use existing `gh` authentication and repository resolution.
- Return compact Markdown summaries instead of raw CLI JSON for better context management.
- Surface GraphQL node IDs needed for review-thread follow-up actions.

## Requirements

- `gh` must be installed and available in `PATH`.
- `gh auth login` must have been completed.
- Private repositories and write operations require the authenticated user/token to have appropriate permissions.

## Tools

| Tool                       | Purpose                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `github_pr_view`           | Show one PR's branch, review, merge, diff, label, assignee, optional file, and optional body details. |
| `github_pr_checks`         | Summarize PR checks/statuses from `gh pr checks` with bucket/state counts and links.                  |
| `github_pr_review_submit`  | Submit a PR review action (`approve`, `request_changes`, or `comment`) through one generic tool.      |
| `github_pr_threads`        | List PR review threads/comments, including unresolved/current filters and GraphQL thread/comment IDs. |
| `github_pr_thread_reply`   | Reply to a review thread by GraphQL thread ID.                                                        |
| `github_pr_react`          | Add a reaction to a GraphQL subject/comment node ID.                                                  |
| `github_pr_thread_resolve` | Resolve or unresolve a review thread by GraphQL thread ID.                                            |

## Notes

- `github_pr_threads` should be used before reply/react/resolve actions so the agent has the correct `Thread ID` or `Comment ID`.
- Review-thread operations use `gh api graphql` because GitHub's review-thread reply and resolve operations are GraphQL-first.
- PR review tools use `gh pr review`; they submit immediately and require appropriate repository permissions.
- Tool content is Markdown by design. Structured data is kept in tool details only for rendering/state, not as raw JSON in the model context.
