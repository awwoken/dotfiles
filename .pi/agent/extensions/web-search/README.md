# web-search

`web-search` adds Pi tools for current web lookup through a local Ollama server.

It registers two tools:

- `web_search` — search the web and return compact, query-focused results.
- `web_fetch` — fetch one URL and return extracted page content plus links.

The extension does not perform browser automation and does not fetch the web directly from Pi. It calls Ollama's local experimental web endpoints and formats the returned data for agent use.

## Requirements

- Ollama must be running at `http://localhost:11434`.
- Ollama web search/fetch support must be available and enabled.
- If Ollama returns `401`, run:

```sh
ollama signin
```

## Tools

### `web_search`

Searches the web using Ollama's `/api/experimental/web_search` endpoint.

Parameters:

- `query` — search query to execute.
- `max_results` — optional maximum result count.

Defaults and limits:

- default: `5` results
- maximum: `8` results
- invalid or missing values fall back to the default

Output includes numbered results with:

- title
- URL
- query-focused snippet

Snippet behavior:

- strips repeated leading page titles when possible;
- removes common stop words from the query;
- scores candidate windows by query-term matches;
- returns a compact snippet of about 240 characters.

Use this tool for discovery. Search snippets are previews, not source material.

### `web_fetch`

Fetches a specific URL using Ollama's `/api/experimental/web_fetch` endpoint.

Parameters:

- `url` — URL to fetch.
- `max_content_chars` — optional maximum page-content characters to return.

Defaults and limits:

- default: `12000` content characters
- maximum: `30000` content characters
- invalid or missing values fall back to the default
- returned links are limited to `20`

Output includes:

- page title
- requested URL
- normalized extracted content
- extracted links, when provided by Ollama

Long content is truncated at a word or newline boundary when possible.

## Usage examples

```text
Use web_search to find current docs for Ollama web_fetch.
```

```text
Use web_fetch on https://example.com and summarize the page.
```

```text
Search the web for recent TypeScript 5.9 release notes, then fetch the official result.
```

## Error behavior

If Ollama is not reachable, the tools fail with a clear connection error:

```text
Could not connect to Ollama at http://localhost:11434. Make sure Ollama is running and web search/fetch is enabled.
```

If Ollama returns `401`, the tools report that authentication is required and suggest `ollama signin`.

Other non-2xx Ollama responses include the HTTP status and response body when available.

## Implementation notes

- The extension is loaded through the root `index.ts` shim, which exports `src/index.ts` for Pi auto-discovery.
- `src/index.ts` registers both Pi tools.
- `src/client.ts` owns the HTTP calls to Ollama.
- `src/config.ts` clamps user-provided limits.
- `src/format.ts`, `src/snippets.ts`, and `src/text.ts` normalize and format tool output.
- There is currently no config file or environment variable override for the Ollama host; it is hardcoded as `http://localhost:11434`.

## Limitations

- Requires local Ollama web capabilities; it does not work as a standalone web client.
- Fetch results are extracted content from Ollama, not guaranteed raw HTML.
- Search results depend on Ollama's experimental endpoint behavior.
- The tools are read-only and do not persist fetched pages or search results.
