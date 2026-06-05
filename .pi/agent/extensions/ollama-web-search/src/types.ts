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

export interface FetchParams {
  url: string
  max_content_chars?: number
}

export interface FetchResponse {
  title?: string
  content?: string
  links?: string[]
}
