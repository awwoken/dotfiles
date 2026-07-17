#!/usr/bin/env node

import {
  parseOptions,
  requiredString,
  runCli,
  runGraphql,
} from "./github-cli.mjs";

const USAGE = `Usage:
  reply-review-thread.mjs --thread-id <id> --body <markdown>

Replies to a pull-request review thread and returns the created comment as JSON.`;

const THREAD_REPLY_MUTATION = /* GraphQL */ `
  mutation PiReplyToReviewThread($threadId: ID!, $body: String!) {
    addPullRequestReviewThreadReply(
      input: { pullRequestReviewThreadId: $threadId, body: $body }
    ) {
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
  }
`;

function replyToReviewThread(tokens) {
  const options = parseOptions(tokens, new Set(["thread-id", "body"]));
  const threadId = requiredString(options, "thread-id");
  const body = requiredString(options, "body");
  const data = runGraphql(THREAD_REPLY_MUTATION, { threadId, body });
  const comment = data.addPullRequestReviewThreadReply?.comment;
  if (!comment)
    throw new Error("GitHub did not return the created review-thread reply.");
  return comment;
}

runCli(USAGE, replyToReviewThread);
