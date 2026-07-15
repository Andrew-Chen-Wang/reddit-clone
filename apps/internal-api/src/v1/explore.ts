import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchTopic } from "@lib/dao/topic/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authNoThrowMiddleware } from "../middleware"
import { exploreSchemaQuery, exploreSchemaResponse } from "./explore.serializer"

const PAGE_SIZE = 6

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

const app = new Hono().get(
  "/",
  authNoThrowMiddleware,
  describeRoute({
    description: "Explore communities grouped by topic",
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
    const query = c.req.valid("query")
    const offset = query.offset ?? 0

    const topics = await fetchTopic(db).getMany(["id", "name", "slug"])

    if (query.topic) {
      const topic = topics.find((t) => t.slug === query.topic)
      if (!topic) return c.json({ topics, sections: [] })

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

    return c.json({ topics, sections })
  },
)

export default app
