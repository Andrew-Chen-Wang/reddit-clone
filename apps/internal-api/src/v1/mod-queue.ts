import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudComment } from "@lib/dao/comment/crud"
import { fetchComment } from "@lib/dao/comment/fetch"
import { processComments } from "@lib/dao/comment/processComment"
import { crudCommentReport } from "@lib/dao/commentReport/crud"
import { fetchCommentReport } from "@lib/dao/commentReport/fetch"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { crudModAction } from "@lib/dao/modAction/crud"
import { emitContentRemoved } from "@lib/dao/notification/emit-helpers"
import { crudPost } from "@lib/dao/post/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { processPosts } from "@lib/dao/post/processPost"
import { crudPostReport } from "@lib/dao/postReport/crud"
import { fetchPostReport } from "@lib/dao/postReport/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import { decodeCursor } from "../utils/pagination"
import {
  modQueueApproveSchemaRequest,
  modQueueCommunityParam,
  modQueueLockSchemaRequest,
  modQueueRemoveSchemaRequest,
  modQueueSchemaQuery,
  modQueueSchemaResponse,
  modQueueStickyCommentSchemaRequest,
  modQueueStickySchemaRequest,
} from "./mod-queue.serializer"

const PAGE_SIZE = 25
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

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

async function resolveQueueCommunities(
  communityIdParam: string,
  userId: string,
): Promise<string[] | null> {
  if (communityIdParam === "mod") {
    return await fetchCommunityModerator(db).getModeratedCommunityIds(userId, "permPostsComments")
  }
  if (!UUID_RE.test(communityIdParam)) return null
  const moderate = await getCommunityAuthz(db).canModerate(
    communityIdParam,
    userId,
    "posts_comments",
  )
  if (!moderate.ok) return null
  return [communityIdParam]
}

async function assertPostPerm(postId: string, userId: string): Promise<string | null> {
  const post = await fetchPost(db).getOne(postId, ["communityId"])
  if (!post?.communityId) return null
  const moderate = await getCommunityAuthz(db).canModerate(
    post.communityId,
    userId,
    "posts_comments",
  )
  if (!moderate.ok) return null
  return post.communityId
}

async function assertCommentPerm(
  commentId: string,
  userId: string,
): Promise<{ communityId: string } | null> {
  const comment = await fetchComment(db).getOne(commentId, ["postId"])
  if (!comment) return null
  const post = await fetchPost(db).getOne(comment.postId, ["communityId"])
  if (!post?.communityId) return null
  const moderate = await getCommunityAuthz(db).canModerate(
    post.communityId,
    userId,
    "posts_comments",
  )
  if (!moderate.ok) return null
  return { communityId: post.communityId }
}

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/:communityId",
    describeRoute({
      description: "Fetch a moderation queue page for a community (or 'mod' for all moderated)",
      responses: {
        200: {
          description: "Moderation queue page",
          content: { "application/json": { schema: resolver(modQueueSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modQueueCommunityParam),
    validator("query", modQueueSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const query = c.req.valid("query")
      const tab = query.tab ?? "needs_review"
      const offset = readOffset(query.cursor ?? null)

      const communityIds = await resolveQueueCommunities(communityId, user.id)
      if (communityIds === null) return throwForbidden(c, "You cannot view this moderation queue")
      if (communityIds.length === 0) return c.json({ data: [], nextCursor: null })

      const fetchLimit = offset + PAGE_SIZE + 1
      const posts = await fetchPost(db).moderationQueue({ communityIds, tab, limit: fetchLimit })
      const comments = await fetchComment(db).moderationQueue({
        communityIds,
        tab,
        limit: fetchLimit,
      })

      const [processedPosts, processedComments, postSummaries, commentSummaries] =
        await Promise.all([
          processPosts(db, posts, user.id),
          processComments(db, comments, user.id, true),
          fetchPostReport(db).getPendingSummaryForPosts(posts.map((p) => p.id)),
          fetchCommentReport(db).getPendingSummaryForComments(comments.map((cm) => cm.id)),
        ])

      const entries = [
        ...posts.map((p, i) => ({
          sortTime: p.createdAt.getTime(),
          sortId: p.id,
          item: {
            targetType: "post" as const,
            communityId: p.communityId!,
            post: processedPosts[i],
            comment: null,
            reportCount: postSummaries.get(p.id)?.count ?? 0,
            reasons: postSummaries.get(p.id)?.reasons ?? [],
            removed: p.removedAt !== null && p.removedByUserId !== null,
            removedByMod: p.removedByUserId !== null,
            held: p.removedAt !== null && p.removedByUserId === null,
            isSpam: p.isSpam,
            approved: p.approvedAt !== null,
            removalReasonId: p.removalReasonId,
            createdAt: p.createdAt.toISOString(),
          },
        })),
        ...comments.map((cm, i) => ({
          sortTime: cm.createdAt.getTime(),
          sortId: cm.id,
          item: {
            targetType: "comment" as const,
            communityId: cm.postCommunityId!,
            post: null,
            comment: processedComments[i],
            reportCount: commentSummaries.get(cm.id)?.count ?? 0,
            reasons: commentSummaries.get(cm.id)?.reasons ?? [],
            removed: cm.removedAt !== null && cm.removedByUserId !== null,
            removedByMod: cm.removedByUserId !== null,
            held: cm.removedAt !== null && cm.removedByUserId === null,
            isSpam: cm.isSpam,
            approved: cm.approvedAt !== null,
            removalReasonId: cm.removalReasonId,
            createdAt: cm.createdAt.toISOString(),
          },
        })),
      ]

      entries.sort((a, b) => {
        if (a.sortTime !== b.sortTime) return b.sortTime - a.sortTime
        return a.sortId < b.sortId ? 1 : a.sortId > b.sortId ? -1 : 0
      })

      const hasMore = entries.length > offset + PAGE_SIZE
      const page = entries.slice(offset, offset + PAGE_SIZE).map((e) => e.item)
      return c.json({ data: page, nextCursor: hasMore ? encodeOffset(offset + PAGE_SIZE) : null })
    },
  )
  .post(
    "/approve",
    describeRoute({
      description: "Approve a post or comment (clears removal, resolves reports)",
      responses: {
        200: {
          description: "Approved",
          content: { "application/json": { schema: resolver(EmptyObject) } },
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
    validator("json", modQueueApproveSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      if (body.postId) {
        const communityId = await assertPostPerm(body.postId, user.id)
        if (!communityId) return throwForbidden(c, "You cannot moderate this post")
        await crudPost(db).modApprove(body.postId, user.id)
        await crudPostReport(db).resolveForPost(body.postId, "approved", user.id)
        await crudModAction(db).log({
          communityId,
          modUserId: user.id,
          action: "approve_post",
          targetPostId: body.postId,
        })
        return c.json({})
      }
      if (body.commentId) {
        const ctx = await assertCommentPerm(body.commentId, user.id)
        if (!ctx) return throwForbidden(c, "You cannot moderate this comment")
        await crudComment(db).modApprove(body.commentId, user.id)
        await crudCommentReport(db).resolveForComment(body.commentId, "approved", user.id)
        await crudModAction(db).log({
          communityId: ctx.communityId,
          modUserId: user.id,
          action: "approve_comment",
          targetCommentId: body.commentId,
        })
        return c.json({})
      }
      return throwBadRequest(c, "Provide a postId or commentId")
    },
  )
  .post(
    "/remove",
    describeRoute({
      description: "Remove (soft-hide) a post or comment and resolve reports",
      responses: {
        200: {
          description: "Removed",
          content: { "application/json": { schema: resolver(EmptyObject) } },
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
    validator("json", modQueueRemoveSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")
      const asSpam = body.asSpam ?? false
      const removalReasonId = body.removalReasonId ?? null

      if (body.postId) {
        const communityId = await assertPostPerm(body.postId, user.id)
        if (!communityId) return throwForbidden(c, "You cannot moderate this post")
        await crudPost(db).modRemove(body.postId, user.id, removalReasonId, asSpam)
        await crudPostReport(db).resolveForPost(body.postId, "removed", user.id)
        await crudModAction(db).log({
          communityId,
          modUserId: user.id,
          action: asSpam ? "remove_post_spam" : "remove_post",
          targetPostId: body.postId,
          details: { removalReasonId },
        })
        await emitContentRemoved(db, {
          targetType: "post",
          targetId: body.postId,
          actorUserId: user.id,
          communityId,
          removalReasonId,
        })
        return c.json({})
      }
      if (body.commentId) {
        const ctx = await assertCommentPerm(body.commentId, user.id)
        if (!ctx) return throwForbidden(c, "You cannot moderate this comment")
        await crudComment(db).modRemove(body.commentId, user.id, removalReasonId, asSpam)
        await crudCommentReport(db).resolveForComment(body.commentId, "removed", user.id)
        await crudModAction(db).log({
          communityId: ctx.communityId,
          modUserId: user.id,
          action: asSpam ? "remove_comment_spam" : "remove_comment",
          targetCommentId: body.commentId,
          details: { removalReasonId },
        })
        await emitContentRemoved(db, {
          targetType: "comment",
          targetId: body.commentId,
          actorUserId: user.id,
          communityId: ctx.communityId,
          removalReasonId,
        })
        return c.json({})
      }
      return throwBadRequest(c, "Provide a postId or commentId")
    },
  )
  .post(
    "/lock",
    describeRoute({
      description: "Lock a post",
      responses: {
        200: {
          description: "Locked",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", modQueueLockSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("json")
      const communityId = await assertPostPerm(postId, user.id)
      if (!communityId) return throwForbidden(c, "You cannot moderate this post")
      await crudPost(db).setLocked(postId, true)
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: "lock_post",
        targetPostId: postId,
      })
      return c.json({})
    },
  )
  .post(
    "/unlock",
    describeRoute({
      description: "Unlock a post",
      responses: {
        200: {
          description: "Unlocked",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", modQueueLockSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("json")
      const communityId = await assertPostPerm(postId, user.id)
      if (!communityId) return throwForbidden(c, "You cannot moderate this post")
      await crudPost(db).setLocked(postId, false)
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: "unlock_post",
        targetPostId: postId,
      })
      return c.json({})
    },
  )
  .post(
    "/sticky",
    describeRoute({
      description: "Set or clear a post's sticky position",
      responses: {
        200: {
          description: "Updated",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", modQueueStickySchemaRequest),
    async (c) => {
      const user = c.var.user
      const { postId, position } = c.req.valid("json")
      const communityId = await assertPostPerm(postId, user.id)
      if (!communityId) return throwForbidden(c, "You cannot moderate this post")
      await crudPost(db).setSticky(postId, communityId, position)
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: position === null ? "unsticky_post" : "sticky_post",
        targetPostId: postId,
      })
      return c.json({})
    },
  )
  .post(
    "/sticky-comment",
    describeRoute({
      description: "Sticky or unsticky a comment",
      responses: {
        200: {
          description: "Updated",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Comment not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", modQueueStickyCommentSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { commentId, sticky } = c.req.valid("json")
      const ctx = await assertCommentPerm(commentId, user.id)
      if (!ctx) return throwForbidden(c, "You cannot moderate this comment")
      const ok = await crudComment(db).setSticky(commentId, sticky)
      if (!ok) return throwNotFound(c, "Comment not found")
      await crudModAction(db).log({
        communityId: ctx.communityId,
        modUserId: user.id,
        action: sticky ? "sticky_comment" : "unsticky_comment",
        targetCommentId: commentId,
      })
      return c.json({})
    },
  )

export default app
