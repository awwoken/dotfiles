import { spawnSync } from "node:child_process";

const GH_TIMEOUT_MS = 30_000;

class UsageError extends Error {}

export function parseOptions(tokens, allowedOptions) {
  const options = new Map();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--"))
      throw new UsageError(`Unexpected argument: ${token}`);

    const key = token.slice(2);
    if (!key) throw new UsageError("Option names cannot be empty.");
    if (!allowedOptions.has(key))
      throw new UsageError(`Unknown option: --${key}`);
    if (options.has(key))
      throw new UsageError(`Option --${key} was provided more than once.`);

    const next = tokens[index + 1];
    if (next === undefined || next.startsWith("--")) {
      options.set(key, true);
      continue;
    }

    options.set(key, next);
    index += 1;
  }

  return options;
}

export function optionalString(options, key) {
  const value = options.get(key);
  if (value === undefined) return undefined;
  if (value === true) throw new UsageError(`Option --${key} requires a value.`);

  const trimmed = value.trim();
  if (!trimmed) throw new UsageError(`Option --${key} cannot be empty.`);
  return trimmed;
}

export function requiredString(options, key) {
  const value = optionalString(options, key);
  if (!value) throw new UsageError(`Missing required option: --${key}`);
  return value;
}

export function integerOption(options, key, fallback, maximum) {
  const value = optionalString(options, key);
  if (value === undefined) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new UsageError(`Option --${key} must be a positive integer.`);
  }
  return Math.min(parsed, maximum);
}

export function booleanOption(options, key, fallback) {
  const value = options.get(key);
  if (value === undefined) return fallback;
  if (value === true || value === "true") return true;
  if (value === "false") return false;
  throw new UsageError(`Option --${key} must be true or false.`);
}

export function enumOption(options, key, values, fallback) {
  const value = optionalString(options, key) ?? fallback;
  if (!values.includes(value)) {
    throw new UsageError(
      `Option --${key} must be one of: ${values.join(", ")}.`,
    );
  }
  return value;
}

function runGh(args) {
  const result = spawnSync("gh", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: GH_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    const detail =
      result.error.code === "ETIMEDOUT"
        ? "command timed out"
        : result.error.message;
    throw new Error(`gh ${args.join(" ")} failed: ${detail}`);
  }

  if (result.status !== 0) {
    const detail =
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      `exit code ${result.status}`;
    throw new Error(`gh ${args.join(" ")} failed: ${detail}`);
  }

  return result.stdout;
}

export function runGhJson(args) {
  const output = runGh(args);
  try {
    return JSON.parse(output);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`gh ${args.join(" ")} returned invalid JSON: ${detail}`);
  }
}

export function runGraphql(query, variables) {
  const args = ["api", "graphql", "-f", `query=${query}`];

  for (const [key, value] of Object.entries(variables)) {
    if (value === undefined) continue;
    if (typeof value === "number" || typeof value === "boolean") {
      args.push("-F", `${key}=${String(value)}`);
    } else {
      args.push("-f", `${key}=${value}`);
    }
  }

  const response = runGhJson(args);
  if (response.errors?.length) {
    const message = response.errors
      .map((error) => error.message)
      .filter(Boolean)
      .join("; ");
    throw new Error(`GitHub GraphQL failed: ${message || "unknown error"}`);
  }
  if (response.data === undefined)
    throw new Error("GitHub GraphQL response did not include data.");
  return response.data;
}

function parseRepoRef(repo) {
  const match = /^([^\s/]+)\/([^\s/]+)$/.exec(repo.trim());
  if (!match)
    throw new UsageError(`Repository must be in OWNER/REPO form, got: ${repo}`);
  return {
    owner: match[1],
    name: match[2],
    nameWithOwner: `${match[1]}/${match[2]}`,
  };
}

export function resolveRepo(repo) {
  if (repo) return parseRepoRef(repo);
  const result = runGhJson(["repo", "view", "--json", "nameWithOwner"]);
  if (!result.nameWithOwner) {
    throw new Error(
      "Could not infer GitHub repository from the current working directory.",
    );
  }
  return parseRepoRef(result.nameWithOwner);
}

export function truncate(value, maximum) {
  const text = (value ?? "").replace(/\r\n?/g, "\n").trim();
  if (text.length <= maximum) return text;

  const sliced = text.slice(0, maximum);
  const boundary = Math.max(sliced.lastIndexOf("\n"), sliced.lastIndexOf(" "));
  const body =
    boundary > Math.floor(maximum * 0.75) ? sliced.slice(0, boundary) : sliced;
  return `${body.trimEnd()}\n\n…truncated to ${maximum} characters.`;
}

export function runCli(usage, execute) {
  const tokens = process.argv.slice(2);
  if (tokens.length === 0 || ["--help", "-h", "help"].includes(tokens[0])) {
    process.stdout.write(`${usage}\n`);
    return;
  }

  try {
    const result = execute(tokens);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${message}${error instanceof UsageError ? `\n\n${usage}` : ""}\n`,
    );
    process.exitCode = 1;
  }
}
