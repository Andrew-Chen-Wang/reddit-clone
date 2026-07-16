import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchComment } from "@lib/dao/comment/fetch"
import { crudCommentVote } from "@lib/dao/commentVote/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  commentVoteSchemaParam,
  commentVoteSchemaRequest,
  commentVoteSchemaResponse,
} from "./comment.serializer"

const app = new Hono().use(authMiddleware).put(
  "/:commentId",
  describeRoute({
    description: "Upvote, downvote, or clear a vote on a comment",
    responses: {
      200: {
        description: "Updated vote counts",
        content: { "application/json": { schema: resolver(commentVoteSchemaResponse) } },
      },
      403: {
        description: "Post is locked",
        content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
      },
      404: {
        description: "Comment not found",
        content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
      },
    },
  }),
  validator("param", commentVoteSchemaParam),
  validator("json", commentVoteSchemaRequest),
  async (c) => {
    const user = c.var.user
    const { commentId } = c.req.valid("param")
    const { value } = c.req.valid("json")

    const comment = await fetchComment(db).getOne(commentId, ["postId"])
    if (!comment) return throwNotFound(c, "Comment not found")

    const post = await fetchPost(db).getOne(comment.postId, [
      "communityId",
      "isLocked",
      "removedAt",
    ])
    if (!post || post.removedAt) return throwNotFound(c, "Comment not found")
    if (post.communityId) {
      const view = await getCommunityAuthz(db).canView(post.communityId, user.id)
      if (!view.ok) return throwNotFound(c, "Comment not found")
    }
    if (post.isLocked) return throwForbidden(c, "This post is locked")

    const result = await crudCommentVote(db).setVote(commentId, user.id, value)
    if (!result) return throwNotFound(c, "Comment not found")

    return c.json(result)
  },
)

export default app
