export interface SearchParams {
  query: string
  max_results?: number
}

export interface SearchResult {
  title: string
  url: string
  content: string
}

export interface SearchResponse {
  results?: SearchResult[]
}

export interface WebSearchDetails {
  resultCount: number
  results: Array<{
    title: string
    url: string
  }>
}

export interface FetchParams {
  url: string
  max_content_chars?: number
}

export interface FetchResponse {
  title?: string
  content?: string
  links?: string[]
}

export interface WebFetchDetails {
  title?: string
  url: string
  contentChars: number
  returnedContentChars: number
  linkCount: number
  truncated: boolean
}
