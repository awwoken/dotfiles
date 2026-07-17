#!/usr/bin/env node

import {
  enumOption,
  integerOption,
  optionalString,
  parseOptions,
  resolveRepo,
  runCli,
  runGraphql,
  truncate,
} from "./github-cli.mjs";

const DEFAULT_THREAD_LIMIT = 30;
const MAX_THREAD_LIMIT = 100;
const MAX_THREADS_TO_SCAN = 250;
const DEFAULT_COMMENTS_PER_THREAD = 10;
const MAX_COMMENTS_PER_THREAD = 25;
const MAX_COMMENT_BODY_CHARS = 1_200;

const USAGE = `Usage:
  list-review-threads.mjs --pr <number> [--repo OWNER/REPO] [--status all|unresolved|resolved] [--outdated all|current|outdated] [--limit <number>] [--comments-per-thread <number>]

Lists pull-request review threads as compact JSON. This command is read-only.`;

const REVIEW_THREADS_QUERY = /* GraphQL */ `
  query PiReviewThreads(
    $owner: String!
    $name: String!
    $number: Int!
    $threadsFirst: Int!
    $commentsFirst: Int!
    $after: String
  ) {
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
  }
`;

function threadMatches(thread, status, outdated) {
  if (status === "unresolved" && thread.isResolved) return false;
  if (status === "resolved" && !thread.isResolved) return false;
  if (outdated === "current" && thread.isOutdated) return false;
  if (outdated === "outdated" && !thread.isOutdated) return false;
  return true;
}

function compactThread(thread) {
  return {
    id: thread.id,
    isResolved: Boolean(thread.isResolved),
    isOutdated: Boolean(thread.isOutdated),
    isCollapsed: Boolean(thread.isCollapsed),
    path: thread.path ?? null,
    line: thread.line ?? thread.originalLine ?? null,
    startLine: thread.startLine ?? thread.originalStartLine ?? null,
    diffSide: thread.diffSide ?? null,
    startDiffSide: thread.startDiffSide ?? null,
    resolvedBy: thread.resolvedBy?.login ?? null,
    comments: (thread.comments?.nodes ?? []).map((comment) => ({
      id: comment.id,
      databaseId: comment.databaseId ?? null,
      url: comment.url ?? null,
      body: truncate(comment.body, MAX_COMMENT_BODY_CHARS),
      author: comment.author?.login ?? null,
      createdAt: comment.createdAt ?? null,
      updatedAt: comment.updatedAt ?? null,
      path: comment.path ?? null,
      line: comment.line ?? comment.originalLine ?? null,
      reactions: (comment.reactionGroups ?? [])
        .filter((group) => group.content && (group.users?.totalCount ?? 0) > 0)
        .map((group) => ({
          content: group.content,
          count: group.users.totalCount,
        })),
    })),
  };
}

function listReviewThreads(tokens) {
  const options = parseOptions(
    tokens,
    new Set([
      "pr",
      "repo",
      "status",
      "outdated",
      "limit",
      "comments-per-thread",
    ]),
  );
  const number = integerOption(
    options,
    "pr",
    undefined,
    Number.MAX_SAFE_INTEGER,
  );
  if (number === undefined) throw new Error("Missing required option: --pr");

  const repository = resolveRepo(optionalString(options, "repo"));
  const status = enumOption(
    options,
    "status",
    ["all", "unresolved", "resolved"],
    "all",
  );
  const outdated = enumOption(
    options,
    "outdated",
    ["all", "current", "outdated"],
    "all",
  );
  const limit = integerOption(
    options,
    "limit",
    DEFAULT_THREAD_LIMIT,
    MAX_THREAD_LIMIT,
  );
  const commentsPerThread = integerOption(
    options,
    "comments-per-thread",
    DEFAULT_COMMENTS_PER_THREAD,
    MAX_COMMENTS_PER_THREAD,
  );

  const threads = [];
  let after;
  let scannedCount = 0;
  let totalCount = 0;
  let pageHasMore = false;
  let pullRequest;

  do {
    const data = runGraphql(REVIEW_THREADS_QUERY, {
      owner: repository.owner,
      name: repository.name,
      number,
      threadsFirst: Math.min(50, Math.max(limit, 1)),
      commentsFirst: commentsPerThread,
      after,
    });

    const pr = data.repository?.pullRequest;
    if (!pr?.reviewThreads) {
      throw new Error(
        `Pull request ${repository.nameWithOwner}#${number} was not found or has no review thread connection.`,
      );
    }

    pullRequest = {
      number: pr.number,
      title: pr.title ?? null,
      url: pr.url ?? null,
    };
    totalCount = pr.reviewThreads.totalCount;

    const nodes = pr.reviewThreads.nodes ?? [];
    scannedCount += nodes.length;
    for (const thread of nodes) {
      if (threadMatches(thread, status, outdated))
        threads.push(compactThread(thread));
      if (threads.length >= limit) break;
    }

    pageHasMore = Boolean(pr.reviewThreads.pageInfo?.hasNextPage);
    after = pr.reviewThreads.pageInfo?.endCursor ?? undefined;
  } while (
    pageHasMore &&
    threads.length < limit &&
    scannedCount < MAX_THREADS_TO_SCAN
  );

  if (!pullRequest)
    throw new Error(
      `Pull request ${repository.nameWithOwner}#${number} was not found.`,
    );

  return {
    repository: repository.nameWithOwner,
    pullRequest,
    filter: { status, outdated, limit, commentsPerThread },
    totalCount,
    scannedCount,
    pageHasMore,
    returnedCount: threads.length,
    threads,
  };
}

runCli(USAGE, listReviewThreads);
