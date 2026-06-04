import { Type } from "typebox"

import { DEFAULT_FETCH_CONTENT_CHARS, DEFAULT_MAX_RESULTS } from "./constants.ts"

export const WebSearchParams = Type.Object({
  query: Type.String({ description: "The search query to execute" }),
  max_results: Type.Optional(
    Type.Number({ description: "Maximum number of search results to return (default: 5, capped internally)", default: DEFAULT_MAX_RESULTS })
  ),
})

export const WebFetchParams = Type.Object({
  url: Type.String({ description: "The URL to fetch" }),
  max_content_chars: Type.Optional(
    Type.Number({
      description: "Maximum number of page-content characters to return (default: 12000, capped internally)",
      default: DEFAULT_FETCH_CONTENT_CHARS,
    })
  ),
})
