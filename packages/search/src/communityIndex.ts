import type { QueryDslQueryContainer } from "@elastic/elasticsearch/lib/api/types"
import { client } from "./client"
import { type CommunityViewerAccess, communityAccessFilter } from "./communityAccess"
import type { IndexDefinition } from "./indexBootstrap"
import { hitsFrom, nsfwFilter, type SearchResults } from "./searchUtils"

export const COMMUNITY_INDEX = "readit_community"

export interface CommunityDocument {
  name: string
  display_name: string | null
  description: string
  visibility: string
  member_count: number
  is_nsfw: boolean
  topic_slug: string | null
  appear_in_recommendations: boolean
}

export const communityIndexDefinition: IndexDefinition = {
  index: COMMUNITY_INDEX,
  mappings: {
    properties: {
      name: { type: "text", fields: { raw: { type: "keyword" } } },
      display_name: { type: "text" },
      description: { type: "text" },
      visibility: { type: "keyword" },
      member_count: { type: "integer" },
      is_nsfw: { type: "boolean" },
      topic_slug: { type: "keyword" },
      appear_in_recommendations: { type: "boolean" },
    },
  },
}

const ACCESS_FIELDS = { visibilityField: "visibility", communityIdField: "_id" }

export async function indexCommunity(id: string, doc: CommunityDocument): Promise<void> {
  await client.index({ index: COMMUNITY_INDEX, id, document: doc })
}

export async function deleteCommunity(id: string): Promise<void> {
  await client.delete({ index: COMMUNITY_INDEX, id }, { ignore: [404] })
}

export interface SearchCommunitiesParams {
  access: CommunityViewerAccess
  showMature: boolean
  safeSearch: boolean
  limit?: number
  offset?: number
}

export async function searchCommunities(
  query: string,
  params: SearchCommunitiesParams,
): Promise<SearchResults<CommunityDocument>> {
  const filter: QueryDslQueryContainer[] = [communityAccessFilter(params.access, ACCESS_FIELDS)]
  const nsfw = nsfwFilter(params.showMature, params.safeSearch)
  if (nsfw) filter.push(nsfw)

  const response = await client.search<CommunityDocument>({
    index: COMMUNITY_INDEX,
    from: params.offset ?? 0,
    size: params.limit ?? 25,
    query: {
      function_score: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ["name^3", "display_name^2", "description"],
                  fuzziness: "AUTO",
                },
              },
            ],
            filter,
          },
        },
        functions: [
          {
            field_value_factor: { field: "member_count", factor: 1, modifier: "ln1p", missing: 0 },
          },
        ],
        boost_mode: "sum",
      },
    },
  })

  return hitsFrom(response)
}

export async function suggestCommunities(
  query: string,
  params: SearchCommunitiesParams,
): Promise<SearchResults<CommunityDocument>> {
  const filter: QueryDslQueryContainer[] = [communityAccessFilter(params.access, ACCESS_FIELDS)]
  const nsfw = nsfwFilter(params.showMature, params.safeSearch)
  if (nsfw) filter.push(nsfw)

  const response = await client.search<CommunityDocument>({
    index: COMMUNITY_INDEX,
    size: params.limit ?? 5,
    query: {
      function_score: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ["name^3", "display_name^2"],
                  type: "bool_prefix",
                },
              },
            ],
            filter,
          },
        },
        functions: [
          {
            field_value_factor: { field: "member_count", factor: 1, modifier: "ln1p", missing: 0 },
          },
        ],
        boost_mode: "sum",
      },
    },
  })

  return hitsFrom(response)
}

export interface MoreLikeCommunitiesParams {
  likeIds: string[]
  excludeIds: string[]
  access: CommunityViewerAccess
  showMature: boolean
  safeSearch: boolean
  limit?: number
}

export async function moreLikeCommunities(
  params: MoreLikeCommunitiesParams,
): Promise<SearchResults<CommunityDocument>> {
  if (params.likeIds.length === 0) return { total: 0, results: [] }

  const filter: QueryDslQueryContainer[] = [
    communityAccessFilter(params.access, ACCESS_FIELDS),
    { term: { appear_in_recommendations: true } },
  ]
  const nsfw = nsfwFilter(params.showMature, params.safeSearch)
  if (nsfw) filter.push(nsfw)

  const mustNot: QueryDslQueryContainer[] = []
  const excluded = [...new Set([...params.excludeIds, ...params.likeIds])]
  if (excluded.length > 0) mustNot.push({ ids: { values: excluded } })

  const response = await client.search<CommunityDocument>({
    index: COMMUNITY_INDEX,
    size: params.limit ?? 4,
    query: {
      bool: {
        must: [
          {
            more_like_this: {
              fields: ["name", "description"],
              like: params.likeIds.map((id) => ({ _index: COMMUNITY_INDEX, _id: id })),
              min_term_freq: 1,
              min_doc_freq: 1,
              minimum_should_match: "1",
            },
          },
        ],
        filter,
        must_not: mustNot,
      },
    },
  })

  return hitsFrom(response)
}
