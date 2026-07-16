import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchComment } from "@lib/dao/comment/fetch"
import { crudCommentReport } from "@lib/dao/commentReport/crud"
import { crudPostReport } from "@lib/dao/postReport/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwNotFound } from "../utils/http-exception"
import {
  reportCommentSchemaParam,
  reportPostSchemaParam,
  reportSchemaRequest,
  reportSchemaResponse,
} from "./report.serializer"

const app = new Hono()
  .use(authMiddleware)
  .post(
    "/post/:postId",
    describeRoute({
      description: "Report a post",
      responses: {
        200: {
          description: "Report recorded (idempotent)",
          content: { "application/json": { schema: resolver(reportSchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", reportPostSchemaParam),
    validator("json", reportSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("param")
      const body = c.req.valid("json")

      const meta = await fetchPost(db).getOne(postId, ["communityId", "removedAt"])
      if (!meta || meta.removedAt) return throwNotFound(c, "Post not found")
      if (meta.communityId) {
        const view = await getCommunityAuthz(db).canView(meta.communityId, user.id)
        if (!view.ok) return throwNotFound(c, "Post not found")
      }

      await crudPostReport(db).create({
        postId,
        reporterUserId: user.id,
        communityRuleId: body.communityRuleId ?? null,
        reasonText: body.reasonText ?? null,
      })
      return c.json({ reported: true })
    },
  )
  .post(
    "/comment/:commentId",
    describeRoute({
      description: "Report a comment",
      responses: {
        200: {
          description: "Report recorded (idempotent)",
          content: { "application/json": { schema: resolver(reportSchemaResponse) } },
        },
        404: {
          description: "Comment not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", reportCommentSchemaParam),
    validator("json", reportSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { commentId } = c.req.valid("param")
      const body = c.req.valid("json")

      const comment = await fetchComment(db).getOne(commentId, ["postId", "removedAt", "isDeleted"])
      if (!comment || comment.removedAt || comment.isDeleted) {
        return throwNotFound(c, "Comment not found")
      }
      const post = await fetchPost(db).getOne(comment.postId, ["communityId"])
      if (post?.communityId) {
        const view = await getCommunityAuthz(db).canView(post.communityId, user.id)
        if (!view.ok) return throwNotFound(c, "Comment not found")
      }

      await crudCommentReport(db).create({
        commentId,
        reporterUserId: user.id,
        communityRuleId: body.communityRuleId ?? null,
        reasonText: body.reasonText ?? null,
      })
      return c.json({ reported: true })
    },
  )

export default app
