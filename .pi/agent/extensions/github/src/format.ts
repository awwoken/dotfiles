import { MAX_COMMENT_BODY_CHARS, MAX_PR_BODY_CHARS } from "./constants.ts";
import type {
  GitHubActor,
  GitHubFileChange,
  GitHubLabel,
  GitHubPullRequest,
  GitHubReview,
  PullRequestCheck,
  PullRequestReviewComment,
  PullRequestReviewThread,
  ReactionGroup,
  ReactionResult,
  RepoRef,
  ResolveThreadResult,
  ReviewAction,
  ReviewSubmission,
  ReviewThreadsResult,
  ThreadReplyResult,
} from "./types.ts";

function markdownEscape(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function truncate(value: string | null | undefined, maxChars: number): string {
  const text = (value ?? "").replace(/\r\n?/g, "\n").trim();
  if (text.length <= maxChars) return text;
  const sliced = text.slice(0, maxChars);
  const boundary = Math.max(sliced.lastIndexOf("\n"), sliced.lastIndexOf(" "));
  const body = boundary > Math.floor(maxChars * 0.75) ? sliced.slice(0, boundary) : sliced;
  return `${body.trimEnd()}\n\n…truncated to ${maxChars} characters.`;
}

function actorName(actor: GitHubActor | null | undefined): string {
  return actor?.login ? `@${actor.login}` : "unknown";
}

function listNodes<T>(value: { nodes?: T[] } | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.nodes ?? [];
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "unknown";
  return value.replace(/T/, " ").replace(/Z$/, " UTC");
}

function quoteMarkdown(value: string): string {
  return value
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function plural(count: number, singular: string, pluralValue = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function formatLabels(labels: GitHubLabel[]): string {
  const names = labels.map((label) => label.name).filter((name): name is string => Boolean(name));
  return names.length ? names.map((name) => `\`${name}\``).join(", ") : "none";
}

function formatPrState(pr: GitHubPullRequest): string {
  const parts = [pr.state ?? "unknown"];
  if (pr.isDraft) parts.push("draft");
  return parts.join(" / ");
}

function formatReviews(reviews: GitHubReview[]): string[] {
  if (reviews.length === 0) return [];
  return [
    "## Latest reviews",
    ...reviews.slice(0, 10).map((review) => `- ${review.state ?? "UNKNOWN"} by ${actorName(review.author)}${review.submittedAt ? ` at ${formatDate(review.submittedAt)}` : ""}`),
  ];
}

function formatFiles(files: GitHubFileChange[], limit: number): string[] {
  if (files.length === 0) return [];
  const visible = files.slice(0, limit);
  const omitted = files.length - visible.length;
  return [
    "## Changed files",
    ...visible.map((file) => `- \`${file.path ?? "unknown"}\`${typeof file.additions === "number" || typeof file.deletions === "number" ? ` (+${file.additions ?? 0}/-${file.deletions ?? 0})` : ""}`),
    omitted > 0 ? `- …${omitted} more file(s) omitted.` : undefined,
  ].filter((line): line is string => Boolean(line));
}

export function formatPrDetails(pr: GitHubPullRequest, includeBody: boolean, filesLimit: number): string {
  const labels = listNodes(pr.labels);
  const assignees = listNodes(pr.assignees);
  const files = pr.files ?? [];
  const reviews = pr.latestReviews ?? [];
  const body = truncate(pr.body, MAX_PR_BODY_CHARS);

  return [
    `# PR #${pr.number}: ${pr.title ?? "Untitled"}`,
    pr.url ? `URL: ${pr.url}` : undefined,
    "",
    "## Summary",
    `- State: ${formatPrState(pr)}`,
    `- Author: ${actorName(pr.author)}`,
    `- Branches: \`${pr.headRefName ?? "?"}\` → \`${pr.baseRefName ?? "?"}\``,
    `- Review decision: ${pr.reviewDecision ?? "unknown"}`,
    `- Mergeable: ${pr.mergeable ?? "unknown"}`,
    `- Merge state: ${pr.mergeStateStatus ?? "unknown"}`,
    `- Diff stats: +${pr.additions ?? 0}/-${pr.deletions ?? 0} across ${pr.changedFiles ?? files.length ?? 0} changed file(s)` ,
    `- Labels: ${formatLabels(labels)}`,
    `- Assignees: ${assignees.length ? assignees.map(actorName).join(", ") : "none"}`,
    `- Created: ${formatDate(pr.createdAt)}`,
    `- Updated: ${formatDate(pr.updatedAt)}`,
    "",
    ...formatReviews(reviews),
    reviews.length ? "" : undefined,
    ...formatFiles(files, filesLimit),
    files.length ? "" : undefined,
    includeBody ? "## Body" : undefined,
    includeBody ? (body ? quoteMarkdown(body) : "No PR body.") : undefined,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

function threadLocation(thread: PullRequestReviewThread): string {
  const line = thread.line ?? thread.originalLine;
  const startLine = thread.startLine ?? thread.originalStartLine;
  const range = startLine && line && startLine !== line ? `${startLine}-${line}` : line ? String(line) : "?";
  return `${thread.path ?? "unknown"}:${range}`;
}

function formatReactionGroups(groups: ReactionGroup[] | null | undefined): string {
  const parts = (groups ?? [])
    .map((group) => ({ content: group.content, count: group.users?.totalCount ?? 0 }))
    .filter((group) => group.content && group.count > 0)
    .map((group) => `${group.content}:${group.count}`);
  return parts.length ? parts.join(" ") : "none";
}

function formatComment(comment: PullRequestReviewComment, index: number): string[] {
  const body = truncate(comment.body, MAX_COMMENT_BODY_CHARS);
  return [
    `### Comment ${index + 1}: ${actorName(comment.author)} at ${formatDate(comment.createdAt)}`,
    `- Comment ID: \`${comment.id}\`${comment.databaseId ? ` (database ${comment.databaseId})` : ""}`,
    comment.url ? `- URL: ${comment.url}` : undefined,
    `- Reactions: ${formatReactionGroups(comment.reactionGroups)}`,
    body ? "" : undefined,
    body ? quoteMarkdown(body) : "No comment body.",
  ].filter((line): line is string => Boolean(line));
}

function formatThread(thread: PullRequestReviewThread, index: number): string[] {
  const comments = thread.comments?.nodes ?? [];
  const status = thread.isResolved ? "resolved" : "unresolved";
  const outdated = thread.isOutdated ? ", outdated" : "";
  const resolvedBy = thread.resolvedBy?.login ? `, resolved by @${thread.resolvedBy.login}` : "";

  return [
    `## ${index + 1}. ${status} thread at \`${threadLocation(thread)}\``,
    `- Thread ID: \`${thread.id}\``,
    `- State: ${status}${outdated}${resolvedBy}`,
    `- Diff side: ${thread.diffSide ?? "unknown"}${thread.startDiffSide ? ` (start: ${thread.startDiffSide})` : ""}`,
    `- Comments returned: ${comments.length}`,
    "",
    ...comments.flatMap((comment, commentIndex) => [...formatComment(comment, commentIndex), ""]),
  ];
}

export function formatReviewThreads(result: ReviewThreadsResult): string {
  const { repository, pullRequest, filter, threads } = result;

  return [
    `# Review threads for ${repository.nameWithOwner}#${pullRequest.number}`,
    pullRequest.title ? `PR: ${pullRequest.url ? `[${pullRequest.title}](${pullRequest.url})` : pullRequest.title}` : undefined,
    "",
    `Filter: status=${filter.status}, outdated=${filter.outdated}, limit=${filter.limit}, comments_per_thread=${filter.commentsPerThread}`,
    `Matched ${plural(threads.length, "thread")} after scanning ${result.scannedCount} of ${result.totalCount} total thread(s).${result.pageHasMore ? " More pages exist." : ""}`,
    "",
    threads.length === 0 ? "No matching review threads." : undefined,
    ...threads.flatMap((thread, index) => [...formatThread(thread, index), ""]),
    threads.length > 0 ? "Use `Thread ID` values with `github_pr_thread_reply` or `github_pr_thread_resolve`; use `Comment ID` values with `github_pr_react`." : undefined,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n")
    .trim();
}

export function formatThreadReply(reply: ThreadReplyResult): string {
  return [
    "# GitHub review-thread reply created",
    `- Comment ID: \`${reply.id}\``,
    reply.url ? `- URL: ${reply.url}` : undefined,
    `- Author: ${actorName(reply.author)}`,
    `- Created: ${formatDate(reply.createdAt)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatReaction(result: ReactionResult): string {
  return [
    "# GitHub reaction added",
    result.content ? `- Reaction: ${result.content}` : undefined,
    result.id ? `- Reaction ID: \`${result.id}\`` : undefined,
    result.createdAt ? `- Created: ${formatDate(result.createdAt)}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatThreadResolved(result: ResolveThreadResult, desiredResolved: boolean): string {
  return [
    `# GitHub review thread ${desiredResolved ? "resolved" : "marked unresolved"}`,
    `- Thread ID: \`${result.id}\``,
    `- isResolved: ${String(result.isResolved ?? desiredResolved)}`,
    `- isCollapsed: ${String(result.isCollapsed ?? desiredResolved)}`,
  ].join("\n");
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  return entries.length ? entries.map(([key, count]) => `${key}: ${count}`).join(", ") : "none";
}

function statusValue(...values: Array<string | null | undefined>): string {
  return values.find((value): value is string => Boolean(value)) ?? "unknown";
}

export function formatPrChecks(prNumber: number, repository: RepoRef | undefined, checks: PullRequestCheck[], bucketFilter?: string): string {
  const normalizedFilter = bucketFilter?.trim().toLowerCase();
  const visibleChecks = normalizedFilter
    ? checks.filter((check) => [check.bucket, check.state].some((value) => value?.toLowerCase() === normalizedFilter))
    : checks;
  const bucketCounts = countBy(checks.map((check) => statusValue(check.bucket)));
  const stateCounts = countBy(checks.map((check) => statusValue(check.state)));

  return [
    `# PR checks for ${repository ? `${repository.nameWithOwner}#${prNumber}` : `#${prNumber}`}`,
    bucketFilter ? `Filter: bucket/state=${bucketFilter}` : undefined,
    "",
    `Total checks: ${checks.length}; shown: ${visibleChecks.length}`,
    `Buckets: ${formatCounts(bucketCounts)}`,
    `States: ${formatCounts(stateCounts)}`,
    "",
    visibleChecks.length === 0 ? "No checks matched." : undefined,
    visibleChecks.length > 0 ? "| Check | Bucket | State | Workflow | Completed | Link |" : undefined,
    visibleChecks.length > 0 ? "| --- | --- | --- | --- | --- | --- |" : undefined,
    ...visibleChecks.map((check) => {
      const name = markdownEscape(check.name ?? "unnamed");
      const link = check.link ? `[open](${check.link})` : "—";
      return `| ${name} | ${markdownEscape(statusValue(check.bucket))} | ${markdownEscape(statusValue(check.state))} | ${markdownEscape(check.workflow ?? "—")} | ${markdownEscape(formatDate(check.completedAt))} | ${link} |`;
    }),
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

function reviewActionLabel(action: ReviewAction): string {
  switch (action) {
    case "approve":
      return "approved";
    case "request_changes":
      return "requested changes on";
    case "comment":
      return "commented on";
  }
}

export function formatReviewSubmission(submission: ReviewSubmission): string {
  return [
    `# GitHub PR review submitted`,
    `- Action: ${reviewActionLabel(submission.action)}`,
    `- Pull request: ${submission.repo ? `${submission.repo}#${submission.number}` : `#${submission.number}`}`,
    submission.body ? `- Body: ${truncate(submission.body, 240).replace(/\n/g, " ")}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}
