import type {
  AgentToolResult,
  ToolDefinition,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { TSchema } from "typebox";

import {
  GitHubPrChecksParams,
  GitHubPrReactParams,
  GitHubPrReviewSubmitParams,
  GitHubPrThreadReplyParams,
  GitHubPrThreadResolveParams,
  GitHubPrThreadsParams,
  GitHubPrViewParams,
} from "./schema.ts";
import type { ReviewAction } from "./types.ts";

type Renderer<TParams extends TSchema, TDetails> = Pick<
  ToolDefinition<TParams, TDetails>,
  "renderCall" | "renderResult"
>;

type ThemeLike = {
  bold(text: string): string;
  fg(
    color:
      | "accent"
      | "dim"
      | "error"
      | "muted"
      | "success"
      | "toolTitle"
      | "warning",
    text: string,
  ): string;
};

type RenderContextLike = {
  isError: boolean;
};

type PrViewDetails = {
  number: number;
  url?: string | null;
  changedFiles?: number | null;
};

type PrChecksDetails = {
  number: number;
  count: number;
  bucket?: string;
};

type ReviewSubmitDetails = {
  action: ReviewAction;
  number: number;
  repo?: string;
};

type PrThreadsDetails = {
  repository: string;
  pullRequest: number;
  totalCount: number;
  scannedCount: number;
  returnedCount: number;
  threadIds: string[];
};

type ThreadReplyDetails = {
  id: string;
  url?: string | null;
};

type ReactionDetails = {
  id?: string | null;
  content?: string | null;
};

type ThreadResolveDetails = {
  id: string;
  isResolved?: boolean | null;
  isCollapsed?: boolean | null;
};

function firstText<TDetails>(result: AgentToolResult<TDetails>): string {
  return result.content.find((content) => content.type === "text")?.text ?? "";
}

function shortId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}

function truncateInline(value: string, maxLength = 72): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function formatRepo(repo: string | undefined): string {
  return repo?.trim() ? ` ${repo.trim()}` : "";
}

function plural(
  count: number,
  singular: string,
  pluralValue = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function renderCallTitle(
  theme: ThemeLike,
  title: string,
  detail?: string,
): Text {
  const text =
    theme.fg("toolTitle", theme.bold(`${title} `)) +
    (detail ? theme.fg("accent", detail) : "");
  return new Text(text.trimEnd(), 0, 0);
}

function renderMarkdownResult<TDetails>(
  result: AgentToolResult<TDetails>,
  { expanded, isPartial }: ToolRenderResultOptions,
  theme: ThemeLike,
  context: RenderContextLike,
  summary: string,
  partialText: string,
): Text {
  if (isPartial) return new Text(theme.fg("warning", partialText), 0, 0);

  const markdown = firstText(result);
  const status = context.isError
    ? theme.fg("error", "✗")
    : theme.fg("success", "✓");
  const summaryLine = `${status} ${summary}`;

  if (expanded && markdown) {
    return new Text(`${summaryLine}\n${theme.fg("dim", markdown)}`, 0, 0);
  }

  const hint = markdown
    ? theme.fg("dim", ` ${keyHint("app.tools.expand", "expand")}`)
    : "";
  return new Text(`${summaryLine}${hint}`, 0, 0);
}

export const prViewRenderer = {
  renderCall(args, theme, _context) {
    const flags = [
      args.include_body === false ? "no body" : undefined,
      args.include_files ? "files" : undefined,
    ]
      .filter(Boolean)
      .join(", ");
    const detail = `#${Math.trunc(args.number)}${formatRepo(args.repo)}${flags ? ` (${flags})` : ""}`;
    return renderCallTitle(theme, "GitHub PR View", detail);
  },

  renderResult(result, options, theme, context) {
    if (options.isPartial || context.isError) {
      return renderMarkdownResult(
        result,
        options,
        theme,
        context,
        "GitHub PR view failed",
        "Loading PR details…",
      );
    }

    const details = result.details;
    const changedFiles =
      typeof details.changedFiles === "number"
        ? ` • ${plural(details.changedFiles, "file")}`
        : "";
    return renderMarkdownResult(
      result,
      options,
      theme,
      context,
      `PR #${details.number}${changedFiles}`,
      "Loading PR details…",
    );
  },
} satisfies Renderer<typeof GitHubPrViewParams, PrViewDetails>;

export const prChecksRenderer = {
  renderCall(args, theme, _context) {
    const bucket = args.bucket?.trim() ? ` ${args.bucket.trim()}` : "";
    return renderCallTitle(
      theme,
      "GitHub PR Checks",
      `#${Math.trunc(args.number)}${formatRepo(args.repo)}${bucket}`,
    );
  },

  renderResult(result, options, theme, context) {
    if (options.isPartial || context.isError) {
      return renderMarkdownResult(
        result,
        options,
        theme,
        context,
        "GitHub PR checks failed",
        "Loading PR checks…",
      );
    }

    const details = result.details;
    const filter = details.bucket ? ` • ${details.bucket}` : "";
    return renderMarkdownResult(
      result,
      options,
      theme,
      context,
      `PR #${details.number}: ${plural(details.count, "check")}${filter}`,
      "Loading PR checks…",
    );
  },
} satisfies Renderer<typeof GitHubPrChecksParams, PrChecksDetails>;

export const prReviewSubmitRenderer = {
  renderCall(args, theme, _context) {
    return renderCallTitle(
      theme,
      "GitHub PR Review",
      `#${Math.trunc(args.number)} ${args.event}${formatRepo(args.repo)}`,
    );
  },

  renderResult(result, options, theme, context) {
    if (options.isPartial || context.isError) {
      return renderMarkdownResult(
        result,
        options,
        theme,
        context,
        "GitHub PR review failed",
        "Submitting PR review…",
      );
    }

    const details = result.details;
    return renderMarkdownResult(
      result,
      options,
      theme,
      context,
      `${details.action} submitted for PR #${details.number}`,
      "Submitting PR review…",
    );
  },
} satisfies Renderer<typeof GitHubPrReviewSubmitParams, ReviewSubmitDetails>;

export const prThreadsRenderer = {
  renderCall(args, theme, _context) {
    const filters = `${args.status ?? "all"}/${args.outdated ?? "all"}`;
    return renderCallTitle(
      theme,
      "GitHub PR Threads",
      `#${Math.trunc(args.number)}${formatRepo(args.repo)} ${filters}`,
    );
  },

  renderResult(result, options, theme, context) {
    if (options.isPartial || context.isError) {
      return renderMarkdownResult(
        result,
        options,
        theme,
        context,
        "GitHub PR threads failed",
        "Loading PR threads…",
      );
    }

    const details = result.details;
    const summary = `${details.repository}#${details.pullRequest}: ${details.returnedCount}/${details.totalCount} threads (${details.scannedCount} scanned)`;
    return renderMarkdownResult(
      result,
      options,
      theme,
      context,
      summary,
      "Loading PR threads…",
    );
  },
} satisfies Renderer<typeof GitHubPrThreadsParams, PrThreadsDetails>;

export const prThreadReplyRenderer = {
  renderCall(args, theme, _context) {
    const body = truncateInline(args.body, 56);
    return renderCallTitle(
      theme,
      "GitHub PR Thread Reply",
      `${shortId(args.thread_id)}${body ? ` “${body}”` : ""}`,
    );
  },

  renderResult(result, options, theme, context) {
    if (options.isPartial || context.isError) {
      return renderMarkdownResult(
        result,
        options,
        theme,
        context,
        "GitHub thread reply failed",
        "Creating thread reply…",
      );
    }

    const details = result.details;
    return renderMarkdownResult(
      result,
      options,
      theme,
      context,
      `Reply created (${shortId(details.id)})`,
      "Creating thread reply…",
    );
  },
} satisfies Renderer<typeof GitHubPrThreadReplyParams, ThreadReplyDetails>;

export const prReactRenderer = {
  renderCall(args, theme, _context) {
    return renderCallTitle(
      theme,
      "GitHub React",
      `${args.reaction} ${shortId(args.subject_id)}`,
    );
  },

  renderResult(result, options, theme, context) {
    if (options.isPartial || context.isError) {
      return renderMarkdownResult(
        result,
        options,
        theme,
        context,
        "GitHub reaction failed",
        "Adding reaction…",
      );
    }

    const details = result.details;
    const reaction = details.content
      ? `${details.content} reaction`
      : "Reaction";
    return renderMarkdownResult(
      result,
      options,
      theme,
      context,
      `${reaction} added`,
      "Adding reaction…",
    );
  },
} satisfies Renderer<typeof GitHubPrReactParams, ReactionDetails>;

export const prThreadResolveRenderer = {
  renderCall(args, theme, _context) {
    const action = args.resolved === false ? "mark unresolved" : "resolve";
    return renderCallTitle(
      theme,
      "GitHub PR Thread",
      `${action} ${shortId(args.thread_id)}`,
    );
  },

  renderResult(result, options, theme, context) {
    if (options.isPartial || context.isError) {
      return renderMarkdownResult(
        result,
        options,
        theme,
        context,
        "GitHub thread update failed",
        "Updating thread state…",
      );
    }

    const details = result.details;
    const state =
      details.isResolved === false ? "marked unresolved" : "resolved";
    const collapsed =
      typeof details.isCollapsed === "boolean"
        ? ` • collapsed: ${String(details.isCollapsed)}`
        : "";
    return renderMarkdownResult(
      result,
      options,
      theme,
      context,
      `Thread ${state}${collapsed}`,
      "Updating thread state…",
    );
  },
} satisfies Renderer<typeof GitHubPrThreadResolveParams, ThreadResolveDetails>;
