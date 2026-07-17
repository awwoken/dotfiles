#!/usr/bin/env node

import {
  parseOptions,
  requiredString,
  runCli,
  runGraphql,
} from "./github-cli.mjs";

const USAGE = `Usage:
  react-review-comment.mjs --subject-id <id> --reaction <reaction>

Adds a reaction to a GitHub review comment and returns the reaction as JSON.`;

const ADD_REACTION_MUTATION = /* GraphQL */ `
  mutation PiAddReaction($subjectId: ID!, $content: ReactionContent!) {
    addReaction(input: { subjectId: $subjectId, content: $content }) {
      reaction {
        id
        content
        createdAt
      }
    }
  }
`;

function normalizeReaction(input) {
  const key = input.trim().toUpperCase().replace(/[-\s]/g, "_");
  const aliases = {
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
    LOVE: "HEART",
    "🎉": "HOORAY",
    TADA: "HOORAY",
    "😄": "LAUGH",
    "😆": "LAUGH",
    SMILE: "LAUGH",
    "🚀": "ROCKET",
    "👀": "EYES",
    "😕": "CONFUSED",
  };

  const normalized = aliases[key] ?? key;
  const allowed = new Set([
    "THUMBS_UP",
    "THUMBS_DOWN",
    "LAUGH",
    "HOORAY",
    "CONFUSED",
    "HEART",
    "ROCKET",
    "EYES",
  ]);
  if (!allowed.has(normalized)) {
    throw new Error(
      `Unsupported reaction "${input}". Use one of: ${[...allowed].join(", ")}.`,
    );
  }
  return normalized;
}

function reactToReviewComment(tokens) {
  const options = parseOptions(tokens, new Set(["subject-id", "reaction"]));
  const subjectId = requiredString(options, "subject-id");
  const content = normalizeReaction(requiredString(options, "reaction"));
  const data = runGraphql(ADD_REACTION_MUTATION, { subjectId, content });
  const reaction = data.addReaction?.reaction;
  if (!reaction) throw new Error("GitHub did not return the created reaction.");
  return reaction;
}

runCli(USAGE, reactToReviewComment);
