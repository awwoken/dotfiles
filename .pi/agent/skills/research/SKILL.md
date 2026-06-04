---
name: research
description: >-
  Standalone workflow for current external information. Use whenever a task asks
  to research, investigate, compare, verify current facts, find documentation,
  answer API/SDK/CLI questions, search the web, read URLs, or find real-world
  GitHub code examples.
---

# Research Workflow

Use this skill for external research. It covers official documentation lookup,
web discovery, indexed page reading, and public GitHub code search.

## Source routing

Choose the smallest reliable source set:

| Need                                                                                                   | Use                                           | Notes                                                                           |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Current API syntax, configuration, setup, migration, SDK/CLI behavior, library-specific debugging      | `resolve-library-id` then `query-docs`        | Prefer official docs over general web pages.                                    |
| Broad discovery, current non-API facts, project/repo discovery, news, comparisons                      | `web_search`                                  | Discovery only. Snippets are previews, not complete evidence.                   |
| Reading, summarizing, extracting, comparing, or verifying selected web pages                           | `ctx_fetch_and_index` then `ctx_search`       | Never dump raw web pages into context.                                          |
| Exact remote text, source files, code formatting, indentation, raw JSON/YAML, or byte-faithful content | `curl -fsSL` via `ctx_execute` or a temp file | Use raw URLs when available; extracted web fetchers may normalize/corrupt text. |
| Real-world code examples or public repository usage patterns                                           | `grep_searchGitHub` MCP tool                  | Search literal code patterns, not natural-language keywords.                    |

Do not run every research route by default. Stop once the available evidence is sufficient.

## Official documentation lookup

Use this route for developer technologies, including libraries, frameworks, SDKs,
CLI tools, cloud services, setup instructions, config options, API signatures,
and version migration questions. Use it even for familiar tools because API
behavior may have changed.

### Step 1: resolve the library ID

Always call the `resolve-library-id` tool first unless the user explicitly provides a Context7
library ID in `/org/project` or `/org/project/version` format.

Tool input:

```json
{
  "libraryName": "<name>",
  "query": "<user technical intent>"
}
```

Examples:

```json
{
  "libraryName": "React",
  "query": "How to clean up useEffect with async operations"
}
```

```json
{
  "libraryName": "Next.js",
  "query": "How to set up app router middleware"
}
```

```json
{
  "libraryName": "Prisma",
  "query": "How to define one-to-many relations with cascade delete"
}
```

Selection priorities:

1. Exact or near-exact library/package name match.
2. Description relevance to the user's intent.
3. Documentation coverage and code snippet count.
4. Source reputation and benchmark score.
5. Version match if the user requested a specific version.

If the query is ambiguous and there is no safe best match, ask for clarification.
If a version is requested, use the closest listed version-specific ID, such as
`/vercel/next.js/v14.3.0-canary.87`.

### Step 2: query the docs

Call the `query-docs` tool with the selected Context7-compatible library ID.

Tool input:

```json
{
  "libraryId": "<libraryId>",
  "query": "<user technical intent>"
}
```

Examples:

```json
{
  "libraryId": "/facebook/react",
  "query": "React useEffect cleanup function with async operations"
}
```

```json
{
  "libraryId": "/vercel/next.js",
  "query": "How to add authentication middleware to app router"
}
```

```json
{
  "libraryId": "/prisma/prisma",
  "query": "How to define one-to-many relations with cascade delete"
}
```

Query rules:

- Use the user's technical intent as the query; avoid vague one-word queries.
- Do not include secrets, credentials, personal data, proprietary code, or large internal snippets.
- Do not call Context7 tools more than three times for one question. If still incomplete, use the best available result and state the limitation.

Error handling:

- If Context7 reports quota exhaustion or authentication failure, tell the user and note that the tools use the configured `CONTEXT7_API_KEY`. Do not silently fall back to training data.
- If DNS/network failures occur, do not repeatedly retry the same failing call; state the limitation and ask whether to use another research route.

## Web discovery and page reading

Use `web_search` for discovery only. It returns compact titles, URLs, and snippets.
Treat snippets as candidates, not authoritative source material for detailed claims.

Required workflow:

1. Search with `web_search`.
2. Select the relevant URL(s) from the result list.
3. For normal page reading, summarization, verification, comparison, or extraction:
   - fetch selected URL(s) with `ctx_fetch_and_index`, then
   - query indexed content with `ctx_search` using task-specific queries.
4. If exact text is required, use the exact-source workflow below instead.
5. Answer from the indexed snippets or exact-source output and mention/cite selected source URLs when useful.

Search snippets alone are enough only for lightweight discovery, such as listing
candidate links or saying that relevant results exist.

### Exact-source workflow

Use exact-source fetching when the task depends on byte-faithful or formatting-sensitive content,
including source code, indentation, markdown delimiters, HTML-like tokens, raw JSON/YAML, generated
files, diffs, patches, config files, or quoted text.

Rules:

- Prefer raw/source URLs over rendered pages, such as `raw.githubusercontent.com/...` instead of
  `github.com/.../blob/...`.
- Fetch exact remote text with `curl -fsSL` through `ctx_execute` when you need to inspect, diff,
  count, or summarize it without dumping the full file into context.
- If you need to edit or preserve a remote file locally, fetch it to a temporary/tracked file first,
  then use normal file tools on that file.
- Avoid Ollama `web_fetch` and other extracted page readers for exact code/source fidelity: they may
  normalize whitespace, flatten indentation, remove HTML-like angle-bracket text, or omit content.
- For GitHub code examples discovered by search, use `grep_searchGitHub` for usage patterns; use raw
  HTTP fetching only when you need the complete exact file.

Do not:

- Do not use extracted page fetches when exact text, code formatting, indentation, or raw bytes matter.
- Do not ask the user which URL to fetch when the task clearly implies reading the most relevant result(s).
- Do not treat web snippets as authoritative enough for detailed claims.

## Real-world GitHub code search

Use `grep_searchGitHub` when implementation examples or public usage patterns are
needed. This is grep-like code search, not keyword search.

Search for code that would literally appear in files:

- Good: `createAgentSession(`
- Good: `import { createAgentSession`
- Good: `getServerSession(`
- Good regex: `(?s)useEffect\\(\\(\\) => {.*removeEventListener`
- Bad: `best pi examples`
- Bad: `react auth tutorial`
- Bad: `how to use sessions`

Use filters such as `language`, `repo`, and `path` when they reduce noise. Use
`useRegexp=true` for flexible multi-line patterns and `matchCase=true` when case
matters.

Treat GitHub examples as evidence of common usage, not proof of correct or
current API behavior. Prefer official docs for normative claims.

## Combining sources

Use multiple routes only when they answer different parts of the task:

- Docs + GitHub examples: confirm official API, then show common real-world usage.
- Web search + fetch: discover pages, then verify from selected indexed pages.
- Docs + web search: docs for API details, web search for ecosystem or current context.

## Output standards

- Distinguish confirmed facts from likely interpretations.
- Prefer concise summaries over raw excerpts.
- Cite or mention source names/URLs for claims that depend on external evidence.
- If source quality is weak, missing, or conflicting, say so and explain the tradeoff.
