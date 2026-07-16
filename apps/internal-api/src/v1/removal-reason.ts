import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudRemovalReason } from "@lib/dao/removalReason/crud"
import { fetchRemovalReason } from "@lib/dao/removalReason/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  removalReasonCommunityParam,
  removalReasonCreateSchemaRequest,
  removalReasonCreateSchemaResponse,
  removalReasonIdParam,
  removalReasonListSchemaResponse,
  removalReasonReorderSchemaRequest,
  removalReasonUpdateSchemaRequest,
} from "./removal-reason.serializer"

const REMOVAL_REASON_CAP = 50

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/:communityId",
    describeRoute({
      description: "List a community's removal reasons (moderators)",
      responses: {
        200: {
          description: "Removal reasons",
          content: { "application/json": { schema: resolver(removalReasonListSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", removalReasonCommunityParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")

      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id)
      if (!moderate.ok) return throwForbidden(c, "You cannot view removal reasons")

      const reasons = await fetchRemovalReason(db).getManyForCommunity(communityId, [
        "id",
        "title",
        "message",
        "position",
      ])
      return c.json({ data: reasons })
    },
  )
  .post(
    "/:communityId",
    describeRoute({
      description: "Create a removal reason (config permission)",
      responses: {
        201: {
          description: "Removal reason created",
          content: { "application/json": { schema: resolver(removalReasonCreateSchemaResponse) } },
        },
        400: {
          description: "Removal reason cap reached",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", removalReasonCommunityParam),
    validator("json", removalReasonCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage removal reasons")

      const count = await fetchRemovalReason(db).countForCommunity(communityId)
      if (count >= REMOVAL_REASON_CAP) {
        return throwBadRequest(c, "Removal reason limit reached")
      }

      const reason = await crudRemovalReason(db).create({
        communityId,
        title: body.title,
        message: body.message,
        position: count,
      })
      return c.json({ id: reason.id }, 201)
    },
  )
  .patch(
    "/:communityId/reorder",
    describeRoute({
      description: "Reorder removal reasons (config permission)",
      responses: {
        200: {
          description: "Removal reasons reordered",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", removalReasonCommunityParam),
    validator("json", removalReasonReorderSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage removal reasons")

      await crudRemovalReason(db).reorder(communityId, body.orderedIds)
      return c.json({})
    },
  )
  .patch(
    "/reason/:id",
    describeRoute({
      description: "Update a removal reason (config permission)",
      responses: {
        200: {
          description: "Removal reason updated",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Removal reason not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", removalReasonIdParam),
    validator("json", removalReasonUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const reason = await fetchRemovalReason(db).getOne(id, ["communityId"])
      if (!reason) return throwNotFound(c, "Removal reason not found")

      const moderate = await getCommunityAuthz(db).canModerate(
        reason.communityId,
        user.id,
        "config",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot manage removal reasons")

      await crudRemovalReason(db).update(id, body)
      return c.json({})
    },
  )
  .delete(
    "/reason/:id",
    describeRoute({
      description: "Delete a removal reason (config permission)",
      responses: {
        200: {
          description: "Removal reason deleted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Removal reason not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", removalReasonIdParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const reason = await fetchRemovalReason(db).getOne(id, ["communityId"])
      if (!reason) return throwNotFound(c, "Removal reason not found")

      const moderate = await getCommunityAuthz(db).canModerate(
        reason.communityId,
        user.id,
        "config",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot manage removal reasons")

      await crudRemovalReason(db).deleteOne(id)
      return c.json({})
    },
  )

export default app
