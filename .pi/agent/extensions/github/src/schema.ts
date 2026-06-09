import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

import {
  DEFAULT_COMMENTS_PER_THREAD,
  DEFAULT_FILES_LIMIT,
  DEFAULT_THREAD_LIMIT,
} from "./constants.ts";

const RepoParam = Type.Optional(
  Type.String({
    description:
      "Repository in OWNER/REPO form. If omitted, github tools infer the repository from the current working directory using gh.",
  }),
);

const PrNumberParam = Type.Number({ description: "Pull request number." });

export const GitHubPrViewParams = Type.Object({
  repo: RepoParam,
  number: PrNumberParam,
  include_body: Type.Optional(Type.Boolean({ description: "Include the PR body in the Markdown summary (default: true).", default: true })),
  include_files: Type.Optional(Type.Boolean({ description: "Include changed file paths and stats (default: false).", default: false })),
  files_limit: Type.Optional(Type.Number({ description: `Maximum changed files to show when include_files is true (default: ${DEFAULT_FILES_LIMIT}).`, default: DEFAULT_FILES_LIMIT })),
});

export const GitHubPrChecksParams = Type.Object({
  repo: RepoParam,
  number: PrNumberParam,
  bucket: Type.Optional(Type.String({ description: "Optional post-filter for gh check bucket/state, for example pass, fail, pending, skipping, or cancel." })),
});

export const GitHubPrReviewSubmitParams = Type.Object({
  repo: RepoParam,
  number: PrNumberParam,
  event: StringEnum(["approve", "request_changes", "comment"] as const, {
    description: "Review action to submit.",
  }),
  body: Type.Optional(Type.String({ description: "Review body. Required for request_changes and comment." })),
});

export const GitHubPrThreadsParams = Type.Object({
  repo: RepoParam,
  number: PrNumberParam,
  status: Type.Optional(
    StringEnum(["all", "unresolved", "resolved"] as const, {
      description: "Review-thread resolution filter (default: all).",
      default: "all",
    }),
  ),
  outdated: Type.Optional(
    StringEnum(["all", "current", "outdated"] as const, {
      description: "Review-thread outdated filter (default: all).",
      default: "all",
    }),
  ),
  limit: Type.Optional(Type.Number({ description: `Maximum matching threads to return (default: ${DEFAULT_THREAD_LIMIT}, capped internally).`, default: DEFAULT_THREAD_LIMIT })),
  comments_per_thread: Type.Optional(
    Type.Number({
      description: `Maximum comments to include per thread (default: ${DEFAULT_COMMENTS_PER_THREAD}, capped internally).`,
      default: DEFAULT_COMMENTS_PER_THREAD,
    }),
  ),
});

export const GitHubPrThreadReplyParams = Type.Object({
  thread_id: Type.String({ description: "GraphQL node ID of the PullRequestReviewThread to reply to." }),
  body: Type.String({ description: "Markdown body of the reply." }),
});

export const GitHubPrReactParams = Type.Object({
  subject_id: Type.String({ description: "GraphQL node ID of the comment/review/PR to react to. For review threads, use a comment ID from github_pr_threads." }),
  reaction: Type.String({
    description:
      "Reaction to add. Accepts GitHub GraphQL names (THUMBS_UP, HEART, HOORAY, LAUGH, ROCKET, EYES, CONFUSED, THUMBS_DOWN) or common aliases like +1, -1, 👍, ❤️.",
  }),
});

export const GitHubPrThreadResolveParams = Type.Object({
  thread_id: Type.String({ description: "GraphQL node ID of the PullRequestReviewThread to resolve or unresolve." }),
  resolved: Type.Optional(Type.Boolean({ description: "true resolves the thread; false marks it unresolved (default: true).", default: true })),
});
