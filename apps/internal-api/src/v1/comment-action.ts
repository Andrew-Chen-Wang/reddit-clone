import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchComment } from "@lib/dao/comment/fetch"
import { crudCommentFollow } from "@lib/dao/commentFollow/crud"
import { crudCommentSave } from "@lib/dao/commentSave/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwNotFound } from "../utils/http-exception"
import {
  commentActionSchemaParam,
  commentFollowStateSchemaResponse,
  commentSaveStateSchemaResponse,
} from "./comment-action.serializer"

async function assertVisibleComment(
  commentId: string,
  viewerId: string,
): Promise<{ ok: true } | { ok: false }> {
  const comment = await fetchComment(db).getOne(commentId, ["postId"])
  if (!comment) return { ok: false }
  const post = await fetchPost(db).getOne(comment.postId, ["communityId"])
  if (!post) return { ok: false }
  if (post.communityId) {
    const view = await getCommunityAuthz(db).canView(post.communityId, viewerId)
    if (!view.ok) return { ok: false }
  }
  return { ok: true }
}

const app = new Hono()
  .use(authMiddleware)
  .put(
    "/save/:commentId",
    describeRoute({
      description: "Save a comment",
      responses: {
        200: {
          description: "Comment saved",
          content: { "application/json": { schema: resolver(commentSaveStateSchemaResponse) } },
        },
        404: {
          description: "Comment not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", commentActionSchemaParam),
    async (c) => {
      const user = c.var.user
      const { commentId } = c.req.valid("param")
      const visible = await assertVisibleComment(commentId, user.id)
      if (!visible.ok) return throwNotFound(c, "Comment not found")
      await crudCommentSave(db).save(commentId, user.id)
      return c.json({ saved: true })
    },
  )
  .delete(
    "/save/:commentId",
    describeRoute({
      description: "Unsave a comment",
      responses: {
        200: {
          description: "Comment unsaved",
          content: { "application/json": { schema: resolver(commentSaveStateSchemaResponse) } },
        },
      },
    }),
    validator("param", commentActionSchemaParam),
    async (c) => {
      const user = c.var.user
      const { commentId } = c.req.valid("param")
      await crudCommentSave(db).unsave(commentId, user.id)
      return c.json({ saved: false })
    },
  )
  .put(
    "/follow/:commentId",
    describeRoute({
      description: "Follow a comment thread",
      responses: {
        200: {
          description: "Comment followed",
          content: { "application/json": { schema: resolver(commentFollowStateSchemaResponse) } },
        },
        404: {
          description: "Comment not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", commentActionSchemaParam),
    async (c) => {
      const user = c.var.user
      const { commentId } = c.req.valid("param")
      const visible = await assertVisibleComment(commentId, user.id)
      if (!visible.ok) return throwNotFound(c, "Comment not found")
      await crudCommentFollow(db).follow(commentId, user.id)
      return c.json({ following: true })
    },
  )
  .delete(
    "/follow/:commentId",
    describeRoute({
      description: "Unfollow a comment thread",
      responses: {
        200: {
          description: "Comment unfollowed",
          content: { "application/json": { schema: resolver(commentFollowStateSchemaResponse) } },
        },
      },
    }),
    validator("param", commentActionSchemaParam),
    async (c) => {
      const user = c.var.user
      const { commentId } = c.req.valid("param")
      await crudCommentFollow(db).unfollow(commentId, user.id)
      return c.json({ following: false })
    },
  )

export default app
