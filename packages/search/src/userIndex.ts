import type { QueryDslQueryContainer } from "@elastic/elasticsearch/lib/api/types"
import { client } from "./client"
import type { IndexDefinition } from "./indexBootstrap"
import { hitsFrom, type SearchResults } from "./searchUtils"

export const USER_INDEX = "readit_user"

export interface UserDocument {
  username: string
  display_name: string | null
  about: string | null
  karma: number
  show_in_search: boolean
}

export const userIndexDefinition: IndexDefinition = {
  index: USER_INDEX,
  mappings: {
    properties: {
      username: { type: "text", fields: { raw: { type: "keyword" } } },
      display_name: { type: "text" },
      about: { type: "text" },
      karma: { type: "integer" },
      show_in_search: { type: "boolean" },
    },
  },
}

export async function indexUser(id: string, doc: UserDocument): Promise<void> {
  await client.index({ index: USER_INDEX, id, document: doc })
}

export async function deleteUser(id: string): Promise<void> {
  await client.delete({ index: USER_INDEX, id }, { ignore: [404] })
}

export interface SearchUsersParams {
  limit?: number
  offset?: number
}

const SEARCHABLE_FILTER: QueryDslQueryContainer = { term: { show_in_search: true } }

export async function searchUsers(
  query: string,
  params: SearchUsersParams = {},
): Promise<SearchResults<UserDocument>> {
  const response = await client.search<UserDocument>({
    index: USER_INDEX,
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
                  fields: ["username^3", "display_name^2", "about"],
                  fuzziness: "AUTO",
                },
              },
            ],
            filter: [SEARCHABLE_FILTER],
          },
        },
        functions: [
          { field_value_factor: { field: "karma", factor: 1, modifier: "ln1p", missing: 0 } },
        ],
        boost_mode: "sum",
      },
    },
  })

  return hitsFrom(response)
}

export async function suggestUsers(
  query: string,
  params: SearchUsersParams = {},
): Promise<SearchResults<UserDocument>> {
  const response = await client.search<UserDocument>({
    index: USER_INDEX,
    size: params.limit ?? 3,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ["username^3", "display_name^2"],
              type: "bool_prefix",
            },
          },
        ],
        filter: [SEARCHABLE_FILTER],
      },
    },
  })

  return hitsFrom(response)
}
