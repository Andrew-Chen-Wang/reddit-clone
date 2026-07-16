import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchModAction } from "@lib/dao/modAction/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwForbidden } from "../utils/http-exception"
import { decodeCursor } from "../utils/pagination"
import { modLogCommunityParam, modLogSchemaQuery, modLogSchemaResponse } from "./mod-log.serializer"

const PAGE_SIZE = 50

function readOffset(cursor: string | null): number {
  if (!cursor) return 0
  try {
    return decodeCursor(cursor).offset
  } catch {
    return 0
  }
}

function encodeOffset(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset, p: "limit/offset", t: "string" })).toString(
    "base64url",
  )
}

const app = new Hono().use(authMiddleware).get(
  "/:communityId",
  describeRoute({
    description: "Fetch a community's moderation log (moderators)",
    responses: {
      200: {
        description: "Moderation log page",
        content: { "application/json": { schema: resolver(modLogSchemaResponse) } },
      },
      403: {
        description: "Not permitted",
        content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
      },
    },
  }),
  validator("param", modLogCommunityParam),
  validator("query", modLogSchemaQuery),
  async (c) => {
    const user = c.var.user
    const { communityId } = c.req.valid("param")
    const query = c.req.valid("query")
    const offset = readOffset(query.cursor ?? null)

    const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id)
    if (!moderate.ok) return throwForbidden(c, "You cannot view the moderation log")

    const rows = await fetchModAction(db).listForCommunities([communityId], PAGE_SIZE + 1, offset)
    const hasMore = rows.length > PAGE_SIZE
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows

    return c.json({
      data: page.map((r) => ({
        id: r.id,
        action: r.action,
        details: (r.details ?? null) as Record<string, unknown> | null,
        createdAt: r.createdAt.toISOString(),
        modUserId: r.modUserId,
        modUsername: r.modUsername,
        targetPostId: r.targetPostId,
        targetPostTitle: r.targetPostTitle,
        targetCommentId: r.targetCommentId,
        targetUserId: r.targetUserId,
        targetUsername: r.targetUsername,
      })),
      nextCursor: hasMore ? encodeOffset(offset + PAGE_SIZE) : null,
    })
  },
)

export default app
