import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { GH_TIMEOUT_MS } from "./constants.ts";
import type { RepoRef } from "./types.ts";

type ExecResult = Awaited<ReturnType<ExtensionAPI["exec"]>>;

type GraphqlResponse<T> = {
  data?: T;
  errors?: { message?: string }[];
};

function formatGhFailure(args: string[], result: ExecResult): Error {
  const stderr = result.stderr?.trim();
  const stdout = result.stdout?.trim();
  const detail = stderr || stdout || (result.killed ? "command timed out" : `exit code ${result.code}`);
  return new Error(`gh ${args.join(" ")} failed: ${detail}`);
}

export function clampNumber(value: number | undefined, fallback: number, max: number, min = 1): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export function parseRepoRef(repo: string): RepoRef {
  const value = repo.trim();
  const match = /^([^\s/]+)\/([^\s/]+)$/.exec(value);
  if (!match) throw new Error(`Repository must be in OWNER/REPO form, got: ${repo}`);

  return {
    owner: match[1],
    name: match[2],
    nameWithOwner: `${match[1]}/${match[2]}`,
  };
}

export async function resolveRepo(pi: ExtensionAPI, cwd: string, repo: string | undefined, signal?: AbortSignal): Promise<RepoRef> {
  if (repo?.trim()) return parseRepoRef(repo);

  const data = await runGhJson<{ nameWithOwner?: string }>(pi, ["repo", "view", "--json", "nameWithOwner"], cwd, signal);
  if (!data.nameWithOwner) throw new Error("Could not infer GitHub repository from current working directory.");
  return parseRepoRef(data.nameWithOwner);
}

export async function runGh(pi: ExtensionAPI, args: string[], cwd: string, signal?: AbortSignal): Promise<ExecResult> {
  const result = await pi.exec("gh", args, { cwd, signal, timeout: GH_TIMEOUT_MS });
  if (result.code !== 0 || result.killed) throw formatGhFailure(args, result);
  return result;
}

function parseGhJson<T>(args: string[], stdout: string): T {
  try {
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw new Error(`gh ${args.join(" ")} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function runGhJson<T>(pi: ExtensionAPI, args: string[], cwd: string, signal?: AbortSignal): Promise<T> {
  const result = await runGh(pi, args, cwd, signal);
  return parseGhJson<T>(args, result.stdout);
}

export async function runGhJsonAllowingExitCodes<T>(
  pi: ExtensionAPI,
  args: string[],
  cwd: string,
  allowedExitCodes: number[],
  signal?: AbortSignal,
): Promise<T> {
  const result = await pi.exec("gh", args, { cwd, signal, timeout: GH_TIMEOUT_MS });
  if (result.killed || ![0, ...allowedExitCodes].includes(result.code ?? 0)) throw formatGhFailure(args, result);
  return parseGhJson<T>(args, result.stdout);
}

export async function runGraphql<T>(
  pi: ExtensionAPI,
  cwd: string,
  query: string,
  variables: Record<string, string | number | boolean | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const args = ["api", "graphql", "-f", `query=${query}`];

  for (const [key, value] of Object.entries(variables)) {
    if (value === undefined) continue;
    if (typeof value === "number" || typeof value === "boolean") {
      args.push("-F", `${key}=${String(value)}`);
    } else {
      args.push("-f", `${key}=${value}`);
    }
  }

  const response = await runGhJson<GraphqlResponse<T>>(pi, args, cwd, signal);

  if (response.errors?.length) {
    const message = response.errors
      .map((error) => error.message)
      .filter((message): message is string => Boolean(message))
      .join("; ");

    throw new Error(`GitHub GraphQL failed: ${message || "unknown error"}`);
  }

  if (response.data === undefined) {
    throw new Error("GitHub GraphQL response did not include data.");
  }

  return response.data;
}
