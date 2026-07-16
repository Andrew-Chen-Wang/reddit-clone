import type { QueryDslQueryContainer } from "@elastic/elasticsearch/lib/api/types"
import { client } from "./client"
import { type CommunityViewerAccess, communityAccessFilter } from "./communityAccess"
import type { IndexDefinition } from "./indexBootstrap"
import {
  commentSort,
  type ContentSort,
  createdAfterFilter,
  hitsFrom,
  nsfwFilter,
  type SearchResults,
} from "./searchUtils"

export const COMMENT_INDEX = "readit_comment"

export interface CommentDocument {
  post_id: string
  post_title: string
  body_text: string
  community_id: string | null
  community_name: string | null
  community_visibility: string
  author_username: string | null
  is_nsfw: boolean
  score: number
  created_at: string | null
}

export const commentIndexDefinition: IndexDefinition = {
  index: COMMENT_INDEX,
  mappings: {
    properties: {
      post_id: { type: "keyword" },
      post_title: { type: "text" },
      body_text: { type: "text" },
      community_id: { type: "keyword" },
      community_name: { type: "text" },
      community_visibility: { type: "keyword" },
      author_username: { type: "keyword" },
      is_nsfw: { type: "boolean" },
      score: { type: "integer" },
      created_at: { type: "date" },
    },
  },
}

export async function indexComment(id: string, doc: CommentDocument): Promise<void> {
  await client.index({ index: COMMENT_INDEX, id, document: doc })
}

export async function deleteComment(id: string): Promise<void> {
  await client.delete({ index: COMMENT_INDEX, id }, { ignore: [404] })
}

export interface SearchCommentsParams {
  access: CommunityViewerAccess
  showMature: boolean
  safeSearch: boolean
  sort?: ContentSort
  communityId?: string | null
  authorUsername?: string | null
  postId?: string | null
  createdAfter?: string | null
  limit?: number
  offset?: number
}

export async function searchComments(
  query: string,
  params: SearchCommentsParams,
): Promise<SearchResults<CommentDocument>> {
  const filter: QueryDslQueryContainer[] = [communityAccessFilter(params.access)]
  const nsfw = nsfwFilter(params.showMature, params.safeSearch)
  if (nsfw) filter.push(nsfw)
  if (params.communityId) filter.push({ term: { community_id: params.communityId } })
  if (params.authorUsername) filter.push({ term: { author_username: params.authorUsername } })
  if (params.postId) filter.push({ term: { post_id: params.postId } })
  const window = createdAfterFilter(params.createdAfter ?? null)
  if (window) filter.push(window)

  const response = await client.search<CommentDocument>({
    index: COMMENT_INDEX,
    from: params.offset ?? 0,
    size: params.limit ?? 25,
    sort: commentSort(params.sort ?? "relevance"),
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ["body_text^2", "post_title"],
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
