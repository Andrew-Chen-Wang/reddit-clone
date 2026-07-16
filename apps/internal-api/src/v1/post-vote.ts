import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchPost } from "@lib/dao/post/fetch"
import { crudPostVote } from "@lib/dao/postVote/crud"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  postVoteSchemaParam,
  postVoteSchemaRequest,
  postVoteSchemaResponse,
} from "./post-vote.serializer"

const app = new Hono().use(authMiddleware).put(
  "/:postId",
  describeRoute({
    description: "Upvote, downvote, or clear a vote on a post",
    responses: {
      200: {
        description: "Updated vote counts",
        content: { "application/json": { schema: resolver(postVoteSchemaResponse) } },
      },
      403: {
        description: "Post is locked",
        content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
      },
      404: {
        description: "Post not found",
        content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
      },
    },
  }),
  validator("param", postVoteSchemaParam),
  validator("json", postVoteSchemaRequest),
  async (c) => {
    const user = c.var.user
    const { postId } = c.req.valid("param")
    const { value } = c.req.valid("json")

    const meta = await fetchPost(db).getOne(postId, ["communityId", "isLocked", "removedAt"])
    if (!meta || meta.removedAt) return throwNotFound(c, "Post not found")

    if (meta.communityId) {
      const view = await getCommunityAuthz(db).canView(meta.communityId, user.id)
      if (!view.ok) return throwNotFound(c, "Post not found")
    }
    if (meta.isLocked) return throwForbidden(c, "This post is locked")

    const result = await crudPostVote(db).setVote(postId, user.id, value)
    if (!result) return throwNotFound(c, "Post not found")

    return c.json(result)
  },
)

export default app
