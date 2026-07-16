import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudPost } from "@lib/dao/post/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { crudPostFollow } from "@lib/dao/postFollow/crud"
import { crudPostHide } from "@lib/dao/postHide/crud"
import { crudPostSave } from "@lib/dao/postSave/crud"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwNotFound } from "../utils/http-exception"
import {
  followStateSchemaResponse,
  hideStateSchemaResponse,
  postActionSchemaParam,
  saveStateSchemaResponse,
  shareSchemaResponse,
} from "./post-action.serializer"

async function assertVisiblePost(
  postId: string,
  viewerId: string,
): Promise<{ ok: true } | { ok: false }> {
  const meta = await fetchPost(db).getOne(postId, ["communityId", "removedAt", "authorUserId"])
  if (!meta) return { ok: false }
  if (meta.communityId) {
    const view = await getCommunityAuthz(db).canView(meta.communityId, viewerId)
    if (!view.ok) return { ok: false }
  }
  if (meta.removedAt && meta.authorUserId !== viewerId) return { ok: false }
  return { ok: true }
}

const app = new Hono()
  .use(authMiddleware)
  .put(
    "/save/:postId",
    describeRoute({
      description: "Save a post",
      responses: {
        200: {
          description: "Post saved",
          content: { "application/json": { schema: resolver(saveStateSchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", postActionSchemaParam),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      const visible = await assertVisiblePost(postId, user.id)
      if (!visible.ok) return throwNotFound(c, "Post not found")
      await crudPostSave(db).save(postId, user.id)
      return c.json({ saved: true })
    },
  )
  .delete(
    "/save/:postId",
    describeRoute({
      description: "Unsave a post",
      responses: {
        200: {
          description: "Post unsaved",
          content: { "application/json": { schema: resolver(saveStateSchemaResponse) } },
        },
      },
    }),
    validator("param", postActionSchemaParam),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      await crudPostSave(db).unsave(postId, user.id)
      return c.json({ saved: false })
    },
  )
  .put(
    "/hide/:postId",
    describeRoute({
      description: "Hide a post from the current user's feeds",
      responses: {
        200: {
          description: "Post hidden",
          content: { "application/json": { schema: resolver(hideStateSchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", postActionSchemaParam),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      const visible = await assertVisiblePost(postId, user.id)
      if (!visible.ok) return throwNotFound(c, "Post not found")
      await crudPostHide(db).hide(postId, user.id)
      return c.json({ hidden: true })
    },
  )
  .delete(
    "/hide/:postId",
    describeRoute({
      description: "Unhide a post",
      responses: {
        200: {
          description: "Post unhidden",
          content: { "application/json": { schema: resolver(hideStateSchemaResponse) } },
        },
      },
    }),
    validator("param", postActionSchemaParam),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      await crudPostHide(db).unhide(postId, user.id)
      return c.json({ hidden: false })
    },
  )
  .put(
    "/follow/:postId",
    describeRoute({
      description: "Follow a post to receive updates",
      responses: {
        200: {
          description: "Post followed",
          content: { "application/json": { schema: resolver(followStateSchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", postActionSchemaParam),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      const visible = await assertVisiblePost(postId, user.id)
      if (!visible.ok) return throwNotFound(c, "Post not found")
      await crudPostFollow(db).follow(postId, user.id)
      return c.json({ following: true })
    },
  )
  .delete(
    "/follow/:postId",
    describeRoute({
      description: "Unfollow a post",
      responses: {
        200: {
          description: "Post unfollowed",
          content: { "application/json": { schema: resolver(followStateSchemaResponse) } },
        },
      },
    }),
    validator("param", postActionSchemaParam),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      await crudPostFollow(db).unfollow(postId, user.id)
      return c.json({ following: false })
    },
  )
  .post(
    "/share/:postId",
    describeRoute({
      description: "Record a share of a post",
      responses: {
        200: {
          description: "Share recorded",
          content: { "application/json": { schema: resolver(shareSchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", postActionSchemaParam),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      const visible = await assertVisiblePost(postId, user.id)
      if (!visible.ok) return throwNotFound(c, "Post not found")
      await crudPost(db).incrementShareCount(postId)
      const updated = await fetchPost(db).getOne(postId, ["shareCount"])
      return c.json({ shareCount: updated?.shareCount ?? 0 })
    },
  )

export default app
