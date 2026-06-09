export type RepoRef = {
  owner: string;
  name: string;
  nameWithOwner: string;
};

export type GitHubActor = {
  login?: string | null;
};

export type GitHubLabel = {
  name?: string | null;
};

export type GitHubPullRequest = {
  additions?: number | null;
  assignees?: { nodes?: GitHubActor[] } | GitHubActor[] | null;
  author?: GitHubActor | null;
  baseRefName?: string | null;
  body?: string | null;
  changedFiles?: number | null;
  createdAt?: string | null;
  deletions?: number | null;
  files?: GitHubFileChange[] | null;
  headRefName?: string | null;
  isDraft?: boolean | null;
  labels?: { nodes?: GitHubLabel[] } | GitHubLabel[] | null;
  latestReviews?: GitHubReview[] | null;
  mergeStateStatus?: string | null;
  mergeable?: string | null;
  number: number;
  reviewDecision?: string | null;
  state?: string | null;
  title?: string | null;
  updatedAt?: string | null;
  url?: string | null;
};

export type GitHubReview = {
  author?: GitHubActor | null;
  body?: string | null;
  state?: string | null;
  submittedAt?: string | null;
};

export type GitHubFileChange = {
  path?: string | null;
  additions?: number | null;
  deletions?: number | null;
};

export type ReviewThreadFilter = {
  status: "all" | "unresolved" | "resolved";
  outdated: "all" | "current" | "outdated";
  limit: number;
  commentsPerThread: number;
};

export type PullRequestReviewThread = {
  id: string;
  isCollapsed?: boolean | null;
  isOutdated?: boolean | null;
  isResolved?: boolean | null;
  path?: string | null;
  line?: number | null;
  originalLine?: number | null;
  startLine?: number | null;
  originalStartLine?: number | null;
  diffSide?: string | null;
  startDiffSide?: string | null;
  resolvedBy?: GitHubActor | null;
  comments?: {
    nodes?: PullRequestReviewComment[] | null;
  } | null;
};

export type PullRequestReviewComment = {
  id: string;
  databaseId?: number | null;
  url?: string | null;
  body?: string | null;
  author?: GitHubActor | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  path?: string | null;
  line?: number | null;
  originalLine?: number | null;
  diffHunk?: string | null;
  reactionGroups?: ReactionGroup[] | null;
};

export type ReactionGroup = {
  content?: string | null;
  users?: {
    totalCount?: number | null;
  } | null;
};

export type ReviewThreadsResult = {
  repository: RepoRef;
  pullRequest: {
    number: number;
    title?: string | null;
    url?: string | null;
  };
  totalCount: number;
  scannedCount: number;
  pageHasMore: boolean;
  threads: PullRequestReviewThread[];
  filter: ReviewThreadFilter;
};

export type ThreadReplyResult = {
  id: string;
  url?: string | null;
  body?: string | null;
  author?: GitHubActor | null;
  createdAt?: string | null;
};

export type ReactionResult = {
  id?: string | null;
  content?: string | null;
  createdAt?: string | null;
};

export type ResolveThreadResult = {
  id: string;
  isResolved?: boolean | null;
  isCollapsed?: boolean | null;
};

export type PullRequestCheck = {
  bucket?: string | null;
  completedAt?: string | null;
  description?: string | null;
  event?: string | null;
  link?: string | null;
  name?: string | null;
  startedAt?: string | null;
  state?: string | null;
  workflow?: string | null;
};

export type ReviewAction = "approve" | "request_changes" | "comment";

export type ReviewSubmission = {
  action: ReviewAction;
  number: number;
  repo?: string;
  body?: string;
};
