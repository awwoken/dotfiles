#!/usr/bin/env node

import {
  booleanOption,
  parseOptions,
  requiredString,
  runCli,
  runGraphql,
} from "./github-cli.mjs";

const USAGE = `Usage:
  resolve-review-thread.mjs --thread-id <id> [--resolved true|false]

Resolves a review thread by default, or marks it unresolved with --resolved false.`;

const RESOLVE_THREAD_MUTATION = /* GraphQL */ `
  mutation PiResolveReviewThread($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
        isCollapsed
      }
    }
  }
`;

const UNRESOLVE_THREAD_MUTATION = /* GraphQL */ `
  mutation PiUnresolveReviewThread($threadId: ID!) {
    unresolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
        isCollapsed
      }
    }
  }
`;

function setReviewThreadResolved(tokens) {
  const options = parseOptions(tokens, new Set(["thread-id", "resolved"]));
  const threadId = requiredString(options, "thread-id");
  const resolved = booleanOption(options, "resolved", true);
  const data = runGraphql(
    resolved ? RESOLVE_THREAD_MUTATION : UNRESOLVE_THREAD_MUTATION,
    { threadId },
  );
  const thread = resolved
    ? data.resolveReviewThread?.thread
    : data.unresolveReviewThread?.thread;
  if (!thread)
    throw new Error(
      `GitHub did not return the ${resolved ? "resolved" : "unresolved"} review thread.`,
    );
  return thread;
}

runCli(USAGE, setReviewThreadResolved);
