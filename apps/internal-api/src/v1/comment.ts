import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudComment } from "@lib/dao/comment/crud"
import { CHILD_PAGE_SIZE, fetchComment, ROOT_PAGE_SIZE } from "@lib/dao/comment/fetch"
import { processComments } from "@lib/dao/comment/processComment"
import { crudCommentVote } from "@lib/dao/commentVote/crud"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { emitCommentReplyAndMentions } from "@lib/dao/notification/emit-helpers"
import { fetchPost } from "@lib/dao/post/fetch"
import { fetchUserBlock } from "@lib/dao/userBlock/fetch"
import { db } from "@template-nextjs/db"
import { enqueueEsSyncComment } from "@utils/queues"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse, IdParamT } from "../utils/common.serializer"
import { decodeCursor } from "../utils/pagination"
import {
  throwBadRequest,
  throwForbidden,
  throwNotFound,
  throwTooManyRequests,
} from "../utils/http-exception"
import {
  commentCreateSchemaRequest,
  commentCreateSchemaResponse,
  commentTreeSchemaParam,
  commentTreeSchemaQuery,
  commentTreeSchemaResponse,
  commentUpdateSchemaRequest,
} from "./comment.serializer"

const DAY_MS = 24 * 60 * 60 * 1000
const COMMENTS_PER_DAY = 100
const ARCHIVE_AGE_MS = 180 * DAY_MS

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

const app = new Hono()
  .get(
    "/post/:postId",
    authNoThrowMiddleware,
    describeRoute({
      description: "Fetch a page of the comment tree for a post",
      responses: {
        200: {
          description: "Comment tree page",
          content: { "application/json": { schema: resolver(commentTreeSchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", commentTreeSchemaParam),
    validator("query", commentTreeSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      const query = c.req.valid("query")
      const sort = query.sort ?? "best"
      const parentId = query.parentId ?? null
      const offset = readOffset(query.cursor ?? null)

      const meta = await fetchPost(db).getOne(postId, ["communityId", "removedAt", "authorUserId"])
      if (!meta) return throwNotFound(c, "Post not found")
      if (meta.communityId) {
        const view = await getCommunityAuthz(db).canView(meta.communityId, user?.id ?? null)
        if (!view.ok) return throwNotFound(c, "Post not found")
      }

      const isAuthor = meta.authorUserId === (user?.id ?? null)
      let isMod = false
      if (meta.communityId && user) {
        const mod = await getCommunityAuthz(db).canModerate(
          meta.communityId,
          user.id,
          "posts_comments",
        )
        isMod = mod.ok
      }
      if (meta.removedAt && !isAuthor && !isMod) {
        return throwNotFound(c, "Post not found")
      }

      const blockedIds = user
        ? new Set(await fetchUserBlock(db).listBlockedEitherIds(user.id))
        : new Set<string>()
      const notBlocked = (comment: { author: { id: string } | null }): boolean =>
        !comment.author || !blockedIds.has(comment.author.id)

      if (parentId) {
        const subtree = await fetchComment(db).getSubtreeWithAncestors({
          commentId: parentId,
          sort,
        })
        if (!subtree || subtree.focus.postId !== postId) {
          return throwNotFound(c, "Comment not found")
        }
        const data = (
          await processComments(db, [subtree.focus, ...subtree.rows], user?.id ?? null, isMod)
        ).filter(notBlocked)
        const ancestors = (
          await processComments(db, subtree.ancestors, user?.id ?? null, isMod)
        ).filter(notBlocked)
        const nextCursor = subtree.hasMore ? encodeOffset(offset + CHILD_PAGE_SIZE) : null
        return c.json({ data, ancestors, nextCursor })
      }

      const { rows, hasMore } = await fetchComment(db).getTreePage({ postId, sort, offset })
      const data = (await processComments(db, rows, user?.id ?? null, isMod)).filter(notBlocked)
      const nextCursor = hasMore ? encodeOffset(offset + ROOT_PAGE_SIZE) : null
      return c.json({ data, ancestors: [], nextCursor })
    },
  )
  .use(authMiddleware)
  .post(
    "/",
    describeRoute({
      description: "Create a comment on a post",
      responses: {
        201: {
          description: "Comment created",
          content: { "application/json": { schema: resolver(commentCreateSchemaResponse) } },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        429: {
          description: "Daily comment limit reached",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", commentCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      const meta = await fetchPost(db).getOne(body.postId, [
        "communityId",
        "isLocked",
        "removedAt",
        "createdAt",
      ])
      if (!meta || meta.removedAt) return throwNotFound(c, "Post not found")
      if (meta.communityId) {
        const canComment = await getCommunityAuthz(db).canComment(meta.communityId, user.id)
        if (!canComment.ok) {
          if (canComment.reason === "BANNED") {
            return throwForbidden(c, "You are banned from this community")
          }
          return throwNotFound(c, "Post not found")
        }
        const community = await fetchCommunity(db).getOne(meta.communityId, ["archiveOldPosts"])
        if (community?.archiveOldPosts && meta.createdAt.getTime() < Date.now() - ARCHIVE_AGE_MS) {
          return throwForbidden(c, "This post has been archived and can no longer be commented on")
        }
      }
      if (meta.isLocked) return throwForbidden(c, "This post is locked")

      const recent = await fetchComment(db).countRecentByAuthor(
        user.id,
        new Date(Date.now() - DAY_MS),
      )
      if (recent >= COMMENTS_PER_DAY) {
        return throwTooManyRequests(c, "You have reached the daily comment limit")
      }

      const result = await crudComment(db).create({
        postId: body.postId,
        parentCommentId: body.parentCommentId ?? null,
        authorUserId: user.id,
        bodyMd: body.bodyMd,
      })
      if ("error" in result) {
        if (result.error === "PARENT_NOT_FOUND") return throwNotFound(c, "Parent comment not found")
        if (result.error === "POST_MISMATCH") {
          return throwBadRequest(c, "Parent comment belongs to a different post")
        }
        return throwBadRequest(c, "Comment is nested too deeply")
      }

      await crudCommentVote(db).setVote(result.comment.id, user.id, 1)

      await enqueueEsSyncComment(result.comment.id)

      await emitCommentReplyAndMentions(db, {
        postId: body.postId,
        commentId: result.comment.id,
        parentCommentId: body.parentCommentId ?? null,
        actorUserId: user.id,
        bodyMd: body.bodyMd,
        communityId: meta.communityId,
      })

      return c.json({ id: result.comment.id }, 201)
    },
  )
  .patch(
    "/:id",
    describeRoute({
      description: "Edit a comment (author only)",
      responses: {
        200: {
          description: "Comment updated",
          content: { "application/json": { schema: resolver(commentCreateSchemaResponse) } },
        },
        403: {
          description: "Not the author",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Comment not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    validator("json", commentUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const meta = await fetchComment(db).getOne(id, ["authorUserId", "isDeleted"])
      if (!meta || meta.isDeleted) return throwNotFound(c, "Comment not found")
      if (meta.authorUserId !== user.id) return throwForbidden(c, "You cannot edit this comment")

      const updated = await crudComment(db).update(id, user.id, body.bodyMd)
      if (!updated) return throwNotFound(c, "Comment not found")

      await enqueueEsSyncComment(updated.id)

      return c.json({ id: updated.id })
    },
  )
  .delete(
    "/:id",
    describeRoute({
      description: "Delete a comment (author only)",
      responses: {
        200: {
          description: "Comment deleted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not the author",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Comment not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const result = await crudComment(db).deleteOwn(id, user.id)
      if ("error" in result) {
        if (result.error === "NOT_FOUND") return throwNotFound(c, "Comment not found")
        return throwForbidden(c, "You cannot delete this comment")
      }

      await enqueueEsSyncComment(id)

      return c.json({})
    },
  )

export default app
