---
name: research
description: >-
  Standalone workflow for current external information. Use whenever a task asks
  to research, investigate, compare, verify current facts, find documentation,
  answer API/SDK/CLI questions, search the web, read URLs, or find real-world
  GitHub code examples.
---

# Research Workflow

Use this skill for external research. Web search and page extraction are provided
by [`pi-web-access`](https://github.com/nicobailon/pi-web-access), which exposes
`web_search`, `fetch_content`, and `get_search_content`. Do not rely on the
removed local web-search extension or assume a `web_fetch` tool exists.

The workflow covers official documentation lookup, web discovery, selected page
reading, and public GitHub code inspection.

## Source routing

Choose the smallest reliable source set:

| Need                                                                                                   | Use                                              | Notes                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------- |
| Current API syntax, configuration, setup, migration, SDK/CLI behavior, library-specific debugging      | Official docs via `web_search` + `fetch_content` | Restrict discovery to the official domain when practical; fetch the page.  |
| Broad discovery, current non-API facts, project/repo discovery, news, comparisons                      | `web_search` via `pi-web-access`                 | Discovery only. Snippets are previews, not complete evidence.              |
| Reading, summarizing, extracting, comparing, or verifying selected web pages                           | `fetch_content` via `pi-web-access`              | Fetch only the selected relevant page(s).                                  |
| Exact remote text, source files, code formatting, indentation, raw JSON/YAML, or byte-faithful content | `curl -fsSL` or a temp file                      | Use raw URLs when available; extracted page readers may normalize content. |
| Real-world code examples or public repository usage patterns                                           | `fetch_content` on GitHub + `read`/`bash`        | GitHub URLs are cloned locally for exact source inspection.                |

Do not run every research route by default. Stop once the available evidence is sufficient.

## Official documentation lookup

Use this route for developer technologies, including libraries, frameworks, SDKs,
CLI tools, cloud services, setup instructions, config options, API signatures,
and version migration questions. Use it even for familiar tools because API
behavior may have changed.

1. If the relevant official documentation URL is already known or supplied, fetch it directly with
   `fetch_content`; do not search first without a reason.
2. Otherwise, use `web_search` to discover the official documentation page. Restrict results to the
   official documentation or project domain when practical.
3. Fetch the selected page with `fetch_content` and answer from its content, not from search snippets.
4. For version-specific questions, prefer an explicitly versioned documentation URL, release branch,
   tag, changelog, or migration guide. State when the available page only documents the latest release.
5. If official documentation is incomplete, inspect the official source repository or release notes.
   Use third-party explanations only as supplementary evidence and label them accordingly.

Use the user's technical intent as the search query; avoid vague one-word queries. Do not include
secrets, credentials, personal data, proprietary code, or large internal snippets. If DNS, network,
or provider limits block the route, do not repeatedly retry the same failing call; state the
limitation and try a different configured provider or exact official URL when available.

## Web discovery and page reading

Use `web_search` from `pi-web-access` for discovery only. It returns synthesized
results with source citations (or raw results when `workflow: "none"` is used).
Treat snippets and summaries as candidates, not authoritative source material for
detailed claims.

Required workflow:

1. Search with `web_search`.
2. Select the relevant URL(s) from the result list.
3. For normal page reading, summarization, verification, comparison, or extraction, fetch selected URL(s) with `fetch_content`.
4. If the selected result came from a search with `includeContent: true`, use `get_search_content` to retrieve stored full content when needed.
5. If exact text is required, use the exact-source workflow below instead.
6. Answer from the fetched page content or exact-source output and mention/cite selected source URLs when useful.

Search snippets alone are enough only for lightweight discovery, such as listing
candidate links or saying that relevant results exist.

### Exact-source workflow

Use exact-source fetching when the task depends on byte-faithful or formatting-sensitive content,
including source code, indentation, markdown delimiters, HTML-like tokens, raw JSON/YAML, generated
files, diffs, patches, config files, or quoted text.

Rules:

- Prefer raw/source URLs over rendered pages, such as `raw.githubusercontent.com/...` instead of
  `github.com/.../blob/...`.
- Fetch exact remote text with `curl -fsSL` when you need to inspect, diff, count, or summarize it;
  filter/process large responses before returning them, or save them to a temporary file for targeted inspection.
- If you need to edit or preserve a remote file locally, fetch it to a temporary/tracked file first,
  then use normal file tools on that file.
- Avoid extracted page readers for exact code/source fidelity: they may normalize whitespace, flatten
  indentation, remove HTML-like angle-bracket text, or omit content.
- For GitHub code examples, use `fetch_content` on the repository or file URL. It clones repositories
  locally for inspection; use raw HTTP fetching only when you need the complete exact file.

Do not:

- Do not use extracted page fetches when exact text, code formatting, indentation, or raw bytes matter.
- Do not ask the user which URL to fetch when the task clearly implies reading the most relevant result(s).
- Do not treat web snippets as authoritative enough for detailed claims.

## Real-world GitHub code inspection

Use `fetch_content` from `pi-web-access` on the GitHub repository or file URL.
GitHub repositories are cloned locally, returning a local path that can be
explored with `read`, `find`, and `bash`.

For implementation examples, search for code that would literally appear in
files rather than natural-language concepts:

- Good: `createAgentSession(`
- Good: `import { createAgentSession`
- Good: `getServerSession(`
- Good regex: `(?s)useEffect\\(\\(\\) => {.*removeEventListener`
- Bad: `best pi examples`
- Bad: `react auth tutorial`
- Bad: `how to use sessions`

Treat GitHub examples as evidence of common usage, not proof of correct or
current API behavior. Prefer official docs for normative claims.

## Combining sources

Use multiple routes only when they answer different parts of the task:

- Docs + GitHub examples: confirm official API, then show common real-world usage.
- Web search + fetch: discover pages, then verify from selected fetched pages.
- Docs + web search: docs for API details, web search for ecosystem or current context.

## Output standards

- Distinguish confirmed facts from likely interpretations.
- Prefer concise summaries over raw excerpts.
- Cite or mention source names/URLs for claims that depend on external evidence.
- If source quality is weak, missing, or conflicting, say so and explain the tradeoff.
