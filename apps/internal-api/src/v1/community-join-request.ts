import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudCommunityJoinRequest } from "@lib/dao/communityJoinRequest/crud"
import { fetchCommunityJoinRequest } from "@lib/dao/communityJoinRequest/fetch"
import { emitJoinRequestApproved } from "@lib/dao/notification/emit-helpers"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  joinRequestCommunityIdSchemaParam,
  joinRequestIdSchemaParam,
  joinRequestListSchemaResponse,
} from "./community-join-request.serializer"

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/:communityId/pending",
    describeRoute({
      description: "List pending join requests (moderators with users permission)",
      responses: {
        200: {
          description: "Pending join requests",
          content: {
            "application/json": {
              schema: resolver(joinRequestListSchemaResponse),
            },
          },
        },
        403: {
          description: "Not permitted",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", joinRequestCommunityIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")

      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage join requests")

      const requests = await fetchCommunityJoinRequest(db).getPendingForCommunity(communityId)
      return c.json({
        data: requests.map((r) => ({
          id: r.id,
          userId: r.userId,
          username: r.username,
          avatarImageKey: r.avatarImageKey,
          message: r.message,
          createdAt: r.createdAt.toISOString(),
        })),
      })
    },
  )
  .post(
    "/:id/approve",
    describeRoute({
      description: "Approve a join request (moderators with users permission)",
      responses: {
        200: {
          description: "Join request approved",
          content: {
            "application/json": {
              schema: resolver(EmptyObject),
            },
          },
        },
        403: {
          description: "Not permitted",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
        404: {
          description: "Join request not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", joinRequestIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const request = await fetchCommunityJoinRequest(db).getOne(id, ["communityId", "userId"])
      if (!request) return throwNotFound(c, "Join request not found")

      const moderate = await getCommunityAuthz(db).canModerate(
        request.communityId,
        user.id,
        "users",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot manage join requests")

      const result = await crudCommunityJoinRequest(db).resolve(id, user.id, true)
      if (!result.ok) return throwBadRequest(c, "Join request is no longer pending")

      await emitJoinRequestApproved(db, {
        userId: request.userId,
        actorUserId: user.id,
        communityId: request.communityId,
      })

      return c.json({})
    },
  )
  .post(
    "/:id/deny",
    describeRoute({
      description: "Deny a join request (moderators with users permission)",
      responses: {
        200: {
          description: "Join request denied",
          content: {
            "application/json": {
              schema: resolver(EmptyObject),
            },
          },
        },
        403: {
          description: "Not permitted",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
        404: {
          description: "Join request not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", joinRequestIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const request = await fetchCommunityJoinRequest(db).getOne(id, ["communityId"])
      if (!request) return throwNotFound(c, "Join request not found")

      const moderate = await getCommunityAuthz(db).canModerate(
        request.communityId,
        user.id,
        "users",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot manage join requests")

      const result = await crudCommunityJoinRequest(db).resolve(id, user.id, false)
      if (!result.ok) return throwBadRequest(c, "Join request is no longer pending")

      return c.json({})
    },
  )

export default app
