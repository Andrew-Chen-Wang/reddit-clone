import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudScheduledPost } from "@lib/dao/scheduledPost/crud"
import { fetchScheduledPost } from "@lib/dao/scheduledPost/fetch"
import type { DB } from "@template-nextjs/db"
import { db } from "@template-nextjs/db"
import {
  enqueueScheduledPostPublish,
  removeScheduledPostJob,
  scheduledPostJobId,
} from "@utils/queues"
import { Hono } from "hono"
import type { Selectable } from "kysely"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  scheduledPostCommunitySchemaParam,
  scheduledPostCreateSchemaRequest,
  scheduledPostCreateSchemaResponse,
  scheduledPostIdSchemaParam,
  scheduledPostListSchemaResponse,
} from "./scheduled-post.serializer"

function serializeScheduledPost(row: Selectable<DB["scheduledPost"]>) {
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    communityId: row.communityId,
    isProfile: row.isProfile,
    type: row.type,
    title: row.title,
    bodyMd: row.bodyMd,
    linkUrl: row.linkUrl,
    isNsfw: row.isNsfw,
    isSpoiler: row.isSpoiler,
    isOc: row.isOc,
    flairTemplateId: row.flairTemplateId,
    scheduledAt: row.scheduledAt.toISOString(),
    recurrence: row.recurrence,
    status: row.status,
    publishedPostId: row.publishedPostId,
    createdAt: row.createdAt.toISOString(),
  }
}

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/mine",
    describeRoute({
      description: "The current user's scheduled posts",
      responses: {
        200: {
          description: "Scheduled posts",
          content: { "application/json": { schema: resolver(scheduledPostListSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const rows = await fetchScheduledPost(db).listForUser(user.id)
      return c.json({ data: rows.map(serializeScheduledPost) })
    },
  )
  .get(
    "/community/:communityId",
    describeRoute({
      description: "Scheduled posts for a community (moderators only)",
      responses: {
        200: {
          description: "Scheduled posts",
          content: { "application/json": { schema: resolver(scheduledPostListSchemaResponse) } },
        },
        403: {
          description: "Not a moderator",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", scheduledPostCommunitySchemaParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")

      const mod = await getCommunityAuthz(db).canModerate(communityId, user.id, "posts_comments")
      if (!mod.ok) return throwForbidden(c, "You are not a moderator of this community")

      const rows = await fetchScheduledPost(db).listForCommunity(communityId)
      return c.json({ data: rows.map(serializeScheduledPost) })
    },
  )
  .post(
    "/",
    describeRoute({
      description: "Schedule a post for future publication",
      responses: {
        201: {
          description: "Scheduled post created",
          content: {
            "application/json": { schema: resolver(scheduledPostCreateSchemaResponse) },
          },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", scheduledPostCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      const scheduledAt = new Date(body.scheduledAt)
      const now = Date.now()
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= now) {
        return throwBadRequest(c, "scheduledAt must be a future date", undefined, {
          target: "scheduledAt",
        })
      }
      const maxDate = new Date(now)
      maxDate.setMonth(maxDate.getMonth() + 6)
      if (scheduledAt.getTime() > maxDate.getTime()) {
        return throwBadRequest(c, "scheduledAt cannot be more than 6 months away", undefined, {
          target: "scheduledAt",
        })
      }

      if (body.communityId) {
        const canPost = await getCommunityAuthz(db).canPost(body.communityId, user.id)
        if (!canPost.ok) return throwForbidden(c, "You cannot post in this community")
      }

      const created = await crudScheduledPost(db).create({
        authorUserId: user.id,
        communityId: body.communityId ?? null,
        isProfile: !body.communityId,
        type: body.type ?? "text",
        title: body.title,
        bodyMd: body.bodyMd ?? null,
        linkUrl: body.linkUrl ?? null,
        isNsfw: body.isNsfw ?? false,
        isSpoiler: body.isSpoiler ?? false,
        isOc: body.isOc ?? false,
        flairTemplateId: body.communityId ? (body.flairTemplateId ?? null) : null,
        scheduledAt,
        recurrence: body.recurrence ?? null,
      })

      const jobId = scheduledPostJobId(created.id)
      await crudScheduledPost(db).setJobId(created.id, jobId)
      await enqueueScheduledPostPublish(created.id, scheduledAt.getTime() - now, jobId)

      return c.json({ id: created.id }, 201)
    },
  )
  .delete(
    "/:id",
    describeRoute({
      description: "Cancel a scheduled post",
      responses: {
        200: {
          description: "Scheduled post canceled",
          content: {
            "application/json": { schema: resolver(scheduledPostCreateSchemaResponse) },
          },
        },
        404: {
          description: "Scheduled post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", scheduledPostIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const existing = await fetchScheduledPost(db).getOne(id, ["authorUserId", "jobId"])
      if (!existing || existing.authorUserId !== user.id) {
        return throwNotFound(c, "Scheduled post not found")
      }

      const canceled = await crudScheduledPost(db).cancel(id, user.id)
      if (!canceled) return throwNotFound(c, "Scheduled post not found")

      if (existing.jobId) await removeScheduledPostJob(existing.jobId)

      return c.json({ id })
    },
  )

export default app
