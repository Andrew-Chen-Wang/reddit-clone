import { crudModAction, crudPost, fetchAdmin, fetchPost } from "@lib/dao"
import { db } from "@template-nextjs/db"
import { enqueueEsSyncPost } from "@utils/queues"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { EmptyObject, ErrorSchemaResponse, IdParamT } from "../utils/common.serializer"
import { throwNotFound } from "../utils/http-exception"
import { adminAuthMiddleware } from "./middleware"
import { adminPostSchemaQuery, adminPostSchemaResponse } from "./post.serializer"

const PAGE_SIZE = 25

interface AdminPostListItem {
  id: string
  title: string
  communityId: string | null
  communityName: string | null
  authorUsername: string | null
  score: number
  removedAt: string | null
  createdAt: string
}

interface AdminPostListPayload {
  data: AdminPostListItem[]
  nextCursor: string | null
}

const app = new Hono()
  .use(adminAuthMiddleware)
  .get(
    "/",
    describeRoute({
      description: "Search posts by title (includes removed posts)",
      responses: {
        200: {
          description: "Matching posts",
          content: { "application/json": { schema: resolver(adminPostSchemaResponse) } },
        },
      },
    }),
    validator("query", adminPostSchemaQuery),
    async (c) => {
      const query = c.req.valid("query")
      const q = query.q ?? null
      const cursor = query.cursor ?? null
      const rows = await fetchAdmin(db).searchPosts(q, cursor, PAGE_SIZE)
      const payload: AdminPostListPayload = {
        data: rows.map((r) => ({
          id: r.id,
          title: r.title,
          communityId: r.communityId,
          communityName: r.communityName,
          authorUsername: r.authorUsername,
          score: r.score,
          removedAt: r.removedAt ? r.removedAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
        })),
        nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].id : null,
      }
      return c.json(payload)
    },
  )
  .post(
    "/:id/remove",
    describeRoute({
      description: "Remove a post site-wide (admin)",
      responses: {
        200: {
          description: "Post removed",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const post = await fetchPost(db).getOne(id, ["communityId"])
      if (!post) return throwNotFound(c, "Post not found")
      await crudPost(db).modRemove(id, user.id, null, false)
      if (post.communityId) {
        await crudModAction(db).log({
          communityId: post.communityId,
          modUserId: user.id,
          action: "remove_post",
          targetPostId: id,
          details: { admin: true },
        })
      }
      await enqueueEsSyncPost(id)
      return c.json({})
    },
  )
  .post(
    "/:id/restore",
    describeRoute({
      description: "Restore a removed post site-wide (admin)",
      responses: {
        200: {
          description: "Post restored",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const post = await fetchPost(db).getOne(id, ["communityId"])
      if (!post) return throwNotFound(c, "Post not found")
      await crudPost(db).modApprove(id, user.id)
      if (post.communityId) {
        await crudModAction(db).log({
          communityId: post.communityId,
          modUserId: user.id,
          action: "approve_post",
          targetPostId: id,
          details: { admin: true },
        })
      }
      await enqueueEsSyncPost(id)
      return c.json({})
    },
  )

export default app
