import type { QueryDslQueryContainer } from "@elastic/elasticsearch/lib/api/types"
import { client } from "./client"
import { type CommunityViewerAccess, communityAccessFilter } from "./communityAccess"
import type { IndexDefinition } from "./indexBootstrap"
import {
  type ContentSort,
  createdAfterFilter,
  hitsFrom,
  nsfwFilter,
  postSort,
  type SearchResults,
} from "./searchUtils"

export const POST_INDEX = "readit_post"

export interface PostDocument {
  title: string
  body_text: string
  type: string
  community_id: string | null
  community_name: string | null
  community_visibility: string
  author_username: string
  is_nsfw: boolean
  score: number
  comment_count: number
  hot_score: number
  created_at: string | null
}

export const postIndexDefinition: IndexDefinition = {
  index: POST_INDEX,
  mappings: {
    properties: {
      title: { type: "text" },
      body_text: { type: "text" },
      type: { type: "keyword" },
      community_id: { type: "keyword" },
      community_name: { type: "text", fields: { raw: { type: "keyword" } } },
      community_visibility: { type: "keyword" },
      author_username: { type: "keyword" },
      is_nsfw: { type: "boolean" },
      score: { type: "integer" },
      comment_count: { type: "integer" },
      hot_score: { type: "double" },
      created_at: { type: "date" },
    },
  },
}

export async function indexPost(id: string, doc: PostDocument): Promise<void> {
  await client.index({ index: POST_INDEX, id, document: doc })
}

export async function deletePost(id: string): Promise<void> {
  await client.delete({ index: POST_INDEX, id }, { ignore: [404] })
}

export interface SearchPostsParams {
  access: CommunityViewerAccess
  showMature: boolean
  safeSearch: boolean
  sort?: ContentSort
  communityId?: string | null
  authorUsername?: string | null
  mediaOnly?: boolean
  createdAfter?: string | null
  limit?: number
  offset?: number
}

export async function searchPosts(
  query: string,
  params: SearchPostsParams,
): Promise<SearchResults<PostDocument>> {
  const filter: QueryDslQueryContainer[] = [communityAccessFilter(params.access)]
  const nsfw = nsfwFilter(params.showMature, params.safeSearch)
  if (nsfw) filter.push(nsfw)
  if (params.communityId) filter.push({ term: { community_id: params.communityId } })
  if (params.authorUsername) filter.push({ term: { author_username: params.authorUsername } })
  if (params.mediaOnly) filter.push({ term: { type: "media" } })
  const window = createdAfterFilter(params.createdAfter ?? null)
  if (window) filter.push(window)

  const response = await client.search<PostDocument>({
    index: POST_INDEX,
    from: params.offset ?? 0,
    size: params.limit ?? 25,
    sort: postSort(params.sort ?? "relevance"),
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ["title^3", "body_text", "community_name^2"],
              fuzziness: "AUTO",
            },
          },
        ],
        filter,
      },
    },
  })

  return hitsFrom(response)
}
