import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { MAX_THREADS_TO_SCAN } from "./constants.ts";
import { runGraphql } from "./gh.ts";
import type {
  PullRequestReviewThread,
  ReactionResult,
  RepoRef,
  ResolveThreadResult,
  ReviewThreadFilter,
  ReviewThreadsResult,
  ThreadReplyResult,
} from "./types.ts";

const REVIEW_THREADS_QUERY = /* GraphQL */ `
query PiReviewThreads($owner: String!, $name: String!, $number: Int!, $threadsFirst: Int!, $commentsFirst: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      title
      url
      reviewThreads(first: $threadsFirst, after: $after) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isCollapsed
          isOutdated
          isResolved
          path
          line
          originalLine
          startLine
          originalStartLine
          diffSide
          startDiffSide
          resolvedBy {
            login
          }
          comments(first: $commentsFirst) {
            nodes {
              id
              databaseId
              url
              body
              author {
                login
              }
              createdAt
              updatedAt
              path
              line
              originalLine
              diffHunk
              reactionGroups {
                content
                users {
                  totalCount
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const THREAD_REPLY_MUTATION = /* GraphQL */ `
mutation PiReplyToReviewThread($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
    comment {
      id
      url
      body
      author {
        login
      }
      createdAt
    }
  }
}`;

const ADD_REACTION_MUTATION = /* GraphQL */ `
mutation PiAddReaction($subjectId: ID!, $content: ReactionContent!) {
  addReaction(input: { subjectId: $subjectId, content: $content }) {
    reaction {
      id
      content
      createdAt
    }
  }
}`;

const RESOLVE_THREAD_MUTATION = /* GraphQL */ `
mutation PiResolveReviewThread($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread {
      id
      isResolved
      isCollapsed
    }
  }
}`;

const UNRESOLVE_THREAD_MUTATION = /* GraphQL */ `
mutation PiUnresolveReviewThread($threadId: ID!) {
  unresolveReviewThread(input: { threadId: $threadId }) {
    thread {
      id
      isResolved
      isCollapsed
    }
  }
}`;

type ReviewThreadsResponse = {
  repository?: {
    pullRequest?: {
      number: number;
      title?: string | null;
      url?: string | null;
      reviewThreads?: {
        totalCount: number;
        pageInfo?: {
          hasNextPage?: boolean | null;
          endCursor?: string | null;
        } | null;
        nodes?: PullRequestReviewThread[] | null;
      } | null;
    } | null;
  } | null;
};

function threadMatches(thread: PullRequestReviewThread, filter: ReviewThreadFilter): boolean {
  if (filter.status === "unresolved" && thread.isResolved) return false;
  if (filter.status === "resolved" && !thread.isResolved) return false;
  if (filter.outdated === "current" && thread.isOutdated) return false;
  if (filter.outdated === "outdated" && !thread.isOutdated) return false;
  return true;
}

export async function fetchReviewThreads(
  pi: ExtensionAPI,
  cwd: string,
  repository: RepoRef,
  number: number,
  filter: ReviewThreadFilter,
  signal?: AbortSignal,
): Promise<ReviewThreadsResult> {
  const threads: PullRequestReviewThread[] = [];
  let after: string | undefined;
  let scannedCount = 0;
  let totalCount = 0;
  let pageHasMore = false;
  let pullRequest: ReviewThreadsResult["pullRequest"] | undefined;

  do {
    const pageSize = Math.min(50, Math.max(filter.limit, 1));
    const data = await runGraphql<ReviewThreadsResponse>(
      pi,
      cwd,
      REVIEW_THREADS_QUERY,
      {
        owner: repository.owner,
        name: repository.name,
        number,
        threadsFirst: pageSize,
        commentsFirst: filter.commentsPerThread,
        after,
      },
      signal,
    );

    const pr = data.repository?.pullRequest;
    if (!pr?.reviewThreads) throw new Error(`Pull request ${repository.nameWithOwner}#${number} was not found or has no review thread connection.`);

    pullRequest = { number: pr.number, title: pr.title, url: pr.url };
    totalCount = pr.reviewThreads.totalCount;

    const nodes = pr.reviewThreads.nodes ?? [];
    scannedCount += nodes.length;
    for (const thread of nodes) {
      if (threadMatches(thread, filter)) threads.push(thread);
      if (threads.length >= filter.limit) break;
    }

    pageHasMore = Boolean(pr.reviewThreads.pageInfo?.hasNextPage);
    after = pr.reviewThreads.pageInfo?.endCursor ?? undefined;
  } while (pageHasMore && threads.length < filter.limit && scannedCount < MAX_THREADS_TO_SCAN);

  if (!pullRequest) throw new Error(`Pull request ${repository.nameWithOwner}#${number} was not found.`);

  return {
    repository,
    pullRequest,
    totalCount,
    scannedCount,
    pageHasMore,
    threads,
    filter,
  };
}

export async function replyToThread(
  pi: ExtensionAPI,
  cwd: string,
  threadId: string,
  body: string,
  signal?: AbortSignal,
): Promise<ThreadReplyResult> {
  const data = await runGraphql<{ addPullRequestReviewThreadReply?: { comment?: ThreadReplyResult | null } | null }>(
    pi,
    cwd,
    THREAD_REPLY_MUTATION,
    { threadId, body },
    signal,
  );

  const comment = data.addPullRequestReviewThreadReply?.comment;
  if (!comment) throw new Error("GitHub did not return the created review-thread reply.");
  return comment;
}

export function normalizeReaction(input: string): string {
  const key = input.trim().toUpperCase().replace(/[-\s]/g, "_");
  const aliases: Record<string, string> = {
    "+1": "THUMBS_UP",
    "👍": "THUMBS_UP",
    THUMB_UP: "THUMBS_UP",
    THUMBSUP: "THUMBS_UP",
    LIKE: "THUMBS_UP",
    "-1": "THUMBS_DOWN",
    "👎": "THUMBS_DOWN",
    THUMB_DOWN: "THUMBS_DOWN",
    THUMBSDOWN: "THUMBS_DOWN",
    DISLIKE: "THUMBS_DOWN",
    "❤️": "HEART",
    "❤": "HEART",
    HEART: "HEART",
    LOVE: "HEART",
    "🎉": "HOORAY",
    HOORAY: "HOORAY",
    TADA: "HOORAY",
    "😄": "LAUGH",
    "😆": "LAUGH",
    LAUGH: "LAUGH",
    SMILE: "LAUGH",
    "🚀": "ROCKET",
    ROCKET: "ROCKET",
    "👀": "EYES",
    EYES: "EYES",
    "😕": "CONFUSED",
    CONFUSED: "CONFUSED",
  };

  const normalized = aliases[key] ?? key;
  const allowed = new Set(["THUMBS_UP", "THUMBS_DOWN", "LAUGH", "HOORAY", "CONFUSED", "HEART", "ROCKET", "EYES"]);
  if (!allowed.has(normalized)) {
    throw new Error(`Unsupported reaction "${input}". Use one of: THUMBS_UP, THUMBS_DOWN, LAUGH, HOORAY, CONFUSED, HEART, ROCKET, EYES.`);
  }

  return normalized;
}

export async function addReaction(
  pi: ExtensionAPI,
  cwd: string,
  subjectId: string,
  reaction: string,
  signal?: AbortSignal,
): Promise<ReactionResult> {
  const content = normalizeReaction(reaction);
  const data = await runGraphql<{ addReaction?: { reaction?: ReactionResult | null } | null }>(
    pi,
    cwd,
    ADD_REACTION_MUTATION,
    { subjectId, content },
    signal,
  );

  const result = data.addReaction?.reaction;
  if (!result) throw new Error("GitHub did not return the created reaction.");
  return result;
}

export async function setThreadResolved(
  pi: ExtensionAPI,
  cwd: string,
  threadId: string,
  resolved: boolean,
  signal?: AbortSignal,
): Promise<ResolveThreadResult> {
  const data = await runGraphql<{
    resolveReviewThread?: { thread?: ResolveThreadResult | null } | null;
    unresolveReviewThread?: { thread?: ResolveThreadResult | null } | null;
  }>(pi, cwd, resolved ? RESOLVE_THREAD_MUTATION : UNRESOLVE_THREAD_MUTATION, { threadId }, signal);

  const thread = resolved ? data.resolveReviewThread?.thread : data.unresolveReviewThread?.thread;
  if (!thread) throw new Error(`GitHub did not return the ${resolved ? "resolved" : "unresolved"} review thread.`);
  return thread;
}
