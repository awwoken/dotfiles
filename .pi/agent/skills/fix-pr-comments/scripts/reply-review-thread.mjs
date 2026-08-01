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
        review: pullRequestReview {
          id
          state
          submittedAt
        }
      }
    }
  }
`;

const DELETE_REPLY_MUTATION = /* GraphQL */ `
  mutation PiDeleteUnsubmittedReviewReply($commentId: ID!) {
    deletePullRequestReviewComment(input: { id: $commentId }) {
      clientMutationId
    }
  }
`;

function deleteUnsubmittedReply(commentId) {
  const data = runGraphql(DELETE_REPLY_MUTATION, { commentId });
  if (!data.deletePullRequestReviewComment) {
    throw new Error(
      "GitHub did not confirm deletion of the unsubmitted review-thread reply.",
    );
  }
}

function replyBelongsToSubmittedReview(comment) {
  return (
    comment.review !== null &&
    comment.review.state !== "PENDING" &&
    comment.review.submittedAt !== null
  );
}

function replyToReviewThread(tokens) {
  const options = parseOptions(tokens, new Set(["thread-id", "body"]));
  const threadId = requiredString(options, "thread-id");
  const body = requiredString(options, "body");
  const data = runGraphql(THREAD_REPLY_MUTATION, { threadId, body });
  const comment = data.addPullRequestReviewThreadReply?.comment;
  if (!comment)
    throw new Error("GitHub did not return the created review-thread reply.");

  if (!replyBelongsToSubmittedReview(comment)) {
    deleteUnsubmittedReply(comment.id);
    throw new Error(
      "GitHub created an unsubmitted review-thread reply; the helper deleted it to avoid leaving a pending comment. Retry this thread individually after any other reply call finishes.",
    );
  }

  return comment;
}

runCli(USAGE, replyToReviewThread);
