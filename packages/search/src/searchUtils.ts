import type {
  QueryDslQueryContainer,
  SearchResponse,
  Sort,
} from "@elastic/elasticsearch/lib/api/types"

export interface SearchHit<T> {
  id: string
  score: number
  source: T
}

export interface SearchResults<T> {
  total: number
  results: SearchHit<T>[]
}

export function hitsFrom<T>(response: SearchResponse<T>): SearchResults<T> {
  return {
    total:
      typeof response.hits.total === "number"
        ? response.hits.total
        : (response.hits.total?.value ?? 0),
    results:
      response.hits.hits?.map((hit) => ({
        id: hit._id ?? "",
        score: hit._score ?? 0,
        source: hit._source as T,
      })) ?? [],
  }
}

export function nsfwFilter(
  showMature: boolean,
  safeSearch: boolean,
): QueryDslQueryContainer | null {
  const includeNsfw = showMature && !safeSearch
  if (includeNsfw) return null
  return { term: { is_nsfw: false } }
}

export type ContentSort = "relevance" | "hot" | "top" | "new" | "comments"

export function postSort(sort: ContentSort): Sort | undefined {
  switch (sort) {
    case "hot":
      return [{ hot_score: "desc" }, { created_at: "desc" }]
    case "top":
      return [{ score: "desc" }, { created_at: "desc" }]
    case "new":
      return [{ created_at: "desc" }]
    case "comments":
      return [{ comment_count: "desc" }, { created_at: "desc" }]
    default:
      return undefined
  }
}

export function commentSort(sort: ContentSort): Sort | undefined {
  switch (sort) {
    case "top":
      return [{ score: "desc" }, { created_at: "desc" }]
    case "new":
      return [{ created_at: "desc" }]
    default:
      return undefined
  }
}

export function createdAfterFilter(createdAfter: string | null): QueryDslQueryContainer | null {
  if (!createdAfter) return null
  return { range: { created_at: { gte: createdAfter } } }
}
