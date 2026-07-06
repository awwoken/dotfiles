import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  DEFAULT_COMMENTS_PER_THREAD,
  DEFAULT_FILES_LIMIT,
  DEFAULT_THREAD_LIMIT,
  MAX_COMMENTS_PER_THREAD,
  MAX_FILES_LIMIT,
  MAX_THREAD_LIMIT,
} from "./constants.ts";
import {
  formatPrChecks,
  formatPrDetails,
  formatReaction,
  formatReviewSubmission,
  formatReviewThreads,
  formatThreadReply,
  formatThreadResolved,
} from "./format.ts";
import { clampNumber, resolveRepo, runGh, runGhJson, runGhJsonAllowingExitCodes } from "./gh.ts";
import { addReaction, fetchReviewThreads, replyToThread, setThreadResolved } from "./graphql.ts";
import {
  prChecksRenderer,
  prReactRenderer,
  prReviewSubmitRenderer,
  prThreadReplyRenderer,
  prThreadResolveRenderer,
  prThreadsRenderer,
  prViewRenderer,
} from "./render.ts";
import {
  GitHubPrChecksParams,
  GitHubPrReactParams,
  GitHubPrReviewSubmitParams,
  GitHubPrThreadReplyParams,
  GitHubPrThreadResolveParams,
  GitHubPrThreadsParams,
  GitHubPrViewParams,
} from "./schema.ts";
import type { GitHubPullRequest, PullRequestCheck, ReviewAction, ReviewSubmission } from "./types.ts";

const PR_VIEW_BASE_FIELDS = [
  "number",
  "title",
  "state",
  "url",
  "author",
  "isDraft",
  "headRefName",
  "baseRefName",
  "createdAt",
  "updatedAt",
  "reviewDecision",
  "mergeable",
  "mergeStateStatus",
  "additions",
  "deletions",
  "changedFiles",
  "labels",
  "assignees",
  "latestReviews",
];

const PR_CHECK_FIELDS = ["bucket", "completedAt", "description", "event", "link", "name", "startedAt", "state", "workflow"].join(",");

function buildPrViewFields(includeBody: boolean, includeFiles: boolean): string {
  return [...PR_VIEW_BASE_FIELDS, includeBody ? "body" : undefined, includeFiles ? "files" : undefined]
    .filter((field): field is string => Boolean(field))
    .join(",");
}

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildReviewArgs(submission: ReviewSubmission): string[] {
  const args = ["pr", "review", String(Math.trunc(submission.number))];
  switch (submission.action) {
    case "approve":
      args.push("--approve");
      break;
    case "request_changes":
      args.push("--request-changes");
      break;
    case "comment":
      args.push("--comment");
      break;
  }

  if (submission.body?.trim()) args.push("--body", submission.body);
  if (submission.repo?.trim()) args.push("--repo", submission.repo.trim());
  return args;
}

async function submitReview(pi: ExtensionAPI, cwd: string, submission: ReviewSubmission, signal?: AbortSignal): Promise<void> {
  if ((submission.action === "request_changes" || submission.action === "comment") && !submission.body?.trim()) {
    throw new Error(`Review body is required for ${submission.action}.`);
  }
  await runGh(pi, buildReviewArgs(submission), cwd, signal);
}

function addOptionalRepo(args: string[], repo: string | undefined): void {
  const value = optionalString(repo);
  if (value) args.push("--repo", value);
}

export default function githubExtension(pi: ExtensionAPI) {
  const promptGuidelines = [
    "Use github_pr_* tools for GitHub pull-request workflows when available; they wrap gh and return concise Markdown instead of raw JSON.",
    "Use github_pr_threads before replying, reacting, or resolving review threads so you have the required GraphQL Thread ID or Comment ID.",
  ];

  pi.registerTool({
    name: "github_pr_view",
    label: "GitHub PR View",
    description: "Get details for one GitHub pull request using gh, returning Markdown with branch, review, merge, diff, label, assignee, and optional file/body context.",
    promptSnippet: "Get concise Markdown details for one GitHub pull request.",
    promptGuidelines,
    parameters: GitHubPrViewParams,
    ...prViewRenderer,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const filesLimit = clampNumber(params.files_limit, DEFAULT_FILES_LIMIT, MAX_FILES_LIMIT);
      const includeBody = params.include_body !== false;
      const includeFiles = params.include_files === true;
      const args = ["pr", "view", String(Math.trunc(params.number)), "--json", buildPrViewFields(includeBody, includeFiles)];
      if (params.repo?.trim()) args.push("--repo", params.repo.trim());

      const pr = await runGhJson<GitHubPullRequest>(pi, args, ctx.cwd, signal);
      const prForFormat = includeFiles ? pr : { ...pr, files: [] };

      return {
        content: [{ type: "text" as const, text: formatPrDetails(prForFormat, includeBody, filesLimit) }],
        details: { number: pr.number, url: pr.url, changedFiles: pr.changedFiles },
      };
    },
  });

  pi.registerTool({
    name: "github_pr_checks",
    label: "GitHub PR Checks",
    description: "Summarize GitHub pull request checks using gh pr checks, returning compact Markdown status tables instead of raw JSON.",
    promptSnippet: "Summarize GitHub PR checks/statuses in compact Markdown.",
    promptGuidelines,
    parameters: GitHubPrChecksParams,
    ...prChecksRenderer,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["pr", "checks", String(Math.trunc(params.number)), "--json", PR_CHECK_FIELDS];
      addOptionalRepo(args, params.repo);
      const checks = await runGhJsonAllowingExitCodes<PullRequestCheck[]>(pi, args, ctx.cwd, [1, 8], signal);
      const repository = params.repo ? await resolveRepo(pi, ctx.cwd, params.repo, signal) : undefined;
      const bucket = optionalString(params.bucket);

      return {
        content: [{ type: "text" as const, text: formatPrChecks(Math.trunc(params.number), repository, checks, bucket) }],
        details: { number: Math.trunc(params.number), count: checks.length, bucket },
      };
    },
  });

  pi.registerTool({
    name: "github_pr_review_submit",
    label: "GitHub PR Review Submit",
    description: "Submit a GitHub pull request review action (approve, request changes, or comment) through gh pr review, returning Markdown confirmation.",
    promptSnippet: "Submit a GitHub PR review action: approve, request_changes, or comment.",
    promptGuidelines,
    parameters: GitHubPrReviewSubmitParams,
    ...prReviewSubmitRenderer,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const action = params.event as ReviewAction;
      const submission: ReviewSubmission = { action, number: Math.trunc(params.number), repo: params.repo, body: params.body };
      await submitReview(pi, ctx.cwd, submission, signal);
      return {
        content: [{ type: "text" as const, text: formatReviewSubmission(submission) }],
        details: { action: submission.action, number: submission.number, repo: submission.repo },
      };
    },
  });

  pi.registerTool({
    name: "github_pr_threads",
    label: "GitHub PR Threads",
    description: "List review comments/threads for one GitHub pull request via GraphQL, with filters such as unresolved/current, returning Markdown with thread and comment node IDs.",
    promptSnippet: "List GitHub PR review threads with filters and Markdown output.",
    promptGuidelines,
    parameters: GitHubPrThreadsParams,
    ...prThreadsRenderer,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const repository = await resolveRepo(pi, ctx.cwd, params.repo, signal);
      const result = await fetchReviewThreads(
        pi,
        ctx.cwd,
        repository,
        Math.trunc(params.number),
        {
          status: params.status ?? "all",
          outdated: params.outdated ?? "all",
          limit: clampNumber(params.limit, DEFAULT_THREAD_LIMIT, MAX_THREAD_LIMIT),
          commentsPerThread: clampNumber(params.comments_per_thread, DEFAULT_COMMENTS_PER_THREAD, MAX_COMMENTS_PER_THREAD),
        },
        signal,
      );

      return {
        content: [{ type: "text" as const, text: formatReviewThreads(result) }],
        details: {
          repository: repository.nameWithOwner,
          pullRequest: result.pullRequest.number,
          totalCount: result.totalCount,
          scannedCount: result.scannedCount,
          returnedCount: result.threads.length,
          threadIds: result.threads.map((thread) => thread.id),
        },
      };
    },
  });

  pi.registerTool({
    name: "github_pr_thread_reply",
    label: "GitHub PR Thread Reply",
    description: "Reply to an existing GitHub pull request review thread via GraphQL, returning Markdown with the created comment ID and URL.",
    promptSnippet: "Reply to a GitHub PR review thread by GraphQL thread ID.",
    promptGuidelines,
    parameters: GitHubPrThreadReplyParams,
    ...prThreadReplyRenderer,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const reply = await replyToThread(pi, ctx.cwd, params.thread_id, params.body, signal);
      return {
        content: [{ type: "text" as const, text: formatThreadReply(reply) }],
        details: { id: reply.id, url: reply.url },
      };
    },
  });

  pi.registerTool({
    name: "github_pr_react",
    label: "GitHub PR React",
    description: "Add an emoji reaction to a GitHub PR, review, issue, or comment node via GraphQL, returning Markdown instead of raw JSON.",
    promptSnippet: "Add a GitHub reaction by GraphQL subject node ID.",
    promptGuidelines,
    parameters: GitHubPrReactParams,
    ...prReactRenderer,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const reaction = await addReaction(pi, ctx.cwd, params.subject_id, params.reaction, signal);
      return {
        content: [{ type: "text" as const, text: formatReaction(reaction) }],
        details: { id: reaction.id, content: reaction.content },
      };
    },
  });

  pi.registerTool({
    name: "github_pr_thread_resolve",
    label: "GitHub PR Thread Resolve",
    description: "Resolve or unresolve a GitHub pull request review thread via GraphQL, returning Markdown status.",
    promptSnippet: "Resolve or unresolve a GitHub PR review thread by GraphQL thread ID.",
    promptGuidelines,
    parameters: GitHubPrThreadResolveParams,
    ...prThreadResolveRenderer,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const desiredResolved = params.resolved !== false;
      const thread = await setThreadResolved(pi, ctx.cwd, params.thread_id, desiredResolved, signal);
      return {
        content: [{ type: "text" as const, text: formatThreadResolved(thread, desiredResolved) }],
        details: { id: thread.id, isResolved: thread.isResolved, isCollapsed: thread.isCollapsed },
      };
    },
  });
}
