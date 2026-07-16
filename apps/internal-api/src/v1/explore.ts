import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchCommunityMember } from "@lib/dao/communityMember/fetch"
import { fetchTopic } from "@lib/dao/topic/fetch"
import { fetchUserSettings } from "@lib/dao/userSettings/fetch"
import { db } from "@template-nextjs/db"
import { ensureSearchIndexes, moreLikeCommunities } from "@template-nextjs/search"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authNoThrowMiddleware } from "../middleware"
import { exploreSchemaQuery, exploreSchemaResponse } from "./explore.serializer"

const PAGE_SIZE = 6
const RECOMMEND_LIMIT = 6
const MORE_LIKE_COUNT = 2
const MORE_LIKE_PER = 4

const COMMUNITY_FIELDS: [
  "id",
  "name",
  "displayName",
  "description",
  "iconImageKey",
  "memberCount",
  "isNsfw",
] = ["id", "name", "displayName", "description", "iconImageKey", "memberCount", "isNsfw"]

interface CommunityCard {
  id: string
  name: string
  displayName: string | null
  description: string
  iconImageKey: string | null
  memberCount: number
  isNsfw: boolean
}

function toCard(row: CommunityCard): CommunityCard {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    iconImageKey: row.iconImageKey,
    memberCount: row.memberCount,
    isNsfw: row.isNsfw,
  }
}

function orderByIds(ids: string[], rows: CommunityCard[]): CommunityCard[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return ids.map((id) => byId.get(id)).filter((r): r is CommunityCard => r !== undefined)
}

async function hydrateCommunities(ids: string[]): Promise<CommunityCard[]> {
  if (ids.length === 0) return []
  const rows = await fetchCommunity(db).getManyByIds(ids, COMMUNITY_FIELDS)
  return orderByIds(ids, rows).map(toCard)
}

const app = new Hono().get(
  "/",
  authNoThrowMiddleware,
  describeRoute({
    description: "Explore communities grouped by topic, with recommendations for signed-in users",
    responses: {
      200: {
        description: "Explore feed",
        content: {
          "application/json": {
            schema: resolver(exploreSchemaResponse),
          },
        },
      },
    },
  }),
  validator("query", exploreSchemaQuery),
  async (c) => {
    const user = c.var.user
    const query = c.req.valid("query")
    const offset = query.offset ?? 0

    const topics = await fetchTopic(db).getMany(["id", "name", "slug"])

    if (query.topic) {
      const topic = topics.find((t) => t.slug === query.topic)
      if (!topic) return c.json({ topics, sections: [], recommended: [], moreLike: [] })

      const rows = await fetchCommunity(db).getManyByTopic(
        topic.id,
        COMMUNITY_FIELDS,
        PAGE_SIZE + 1,
        offset,
      )
      return c.json({
        topics,
        sections: [
          {
            topicId: topic.id,
            topicName: topic.name,
            topicSlug: topic.slug,
            communities: rows.slice(0, PAGE_SIZE).map(toCard),
            hasMore: rows.length > PAGE_SIZE,
          },
        ],
        recommended: [],
        moreLike: [],
      })
    }

    const sections = []
    for (const topic of topics) {
      const rows = await fetchCommunity(db).getManyByTopic(
        topic.id,
        COMMUNITY_FIELDS,
        PAGE_SIZE + 1,
        0,
      )
      if (rows.length === 0) continue
      sections.push({
        topicId: topic.id,
        topicName: topic.name,
        topicSlug: topic.slug,
        communities: rows.slice(0, PAGE_SIZE).map(toCard),
        hasMore: rows.length > PAGE_SIZE,
      })
    }

    let recommended: CommunityCard[] = []
    const moreLike: { basedOn: string; communities: CommunityCard[] }[] = []

    if (user) {
      const settings = await fetchUserSettings(db).getOne(user.id, [
        "showRecommendations",
        "showMature",
        "safeSearch",
      ])
      const showRecommendations = settings?.showRecommendations ?? true
      if (showRecommendations) {
        await ensureSearchIndexes()
        const memberships = await fetchCommunityMember(db).getManyForUser(user.id)
        const joinedIds = memberships.map((m) => m.id)
        if (joinedIds.length > 0) {
          const access = { viewableCommunityIds: joinedIds }
          const showMature = settings?.showMature ?? false
          const safeSearch = settings?.safeSearch ?? true

          const recommendedRes = await moreLikeCommunities({
            likeIds: joinedIds,
            excludeIds: joinedIds,
            access,
            showMature,
            safeSearch,
            limit: RECOMMEND_LIMIT,
          })
          recommended = await hydrateCommunities(recommendedRes.results.map((r) => r.id))

          for (const membership of memberships.slice(0, MORE_LIKE_COUNT)) {
            const similar = await moreLikeCommunities({
              likeIds: [membership.id],
              excludeIds: joinedIds,
              access,
              showMature,
              safeSearch,
              limit: MORE_LIKE_PER,
            })
            const communities = await hydrateCommunities(similar.results.map((r) => r.id))
            if (communities.length > 0) {
              moreLike.push({ basedOn: membership.displayName ?? membership.name, communities })
            }
          }
        }
      }
    }

    return c.json({ topics, sections, recommended, moreLike })
  },
)

export default app
