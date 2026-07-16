import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudModSavedResponse } from "@lib/dao/modSavedResponse/crud"
import { fetchModSavedResponse } from "@lib/dao/modSavedResponse/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  savedResponseCommunityParam,
  savedResponseCreateSchemaRequest,
  savedResponseCreateSchemaResponse,
  savedResponseIdParam,
  savedResponseListSchemaResponse,
  savedResponseUpdateSchemaRequest,
} from "./mod-saved-response.serializer"

const SAVED_RESPONSE_CAP = 50

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/:communityId",
    describeRoute({
      description: "List a community's saved responses (moderators)",
      responses: {
        200: {
          description: "Saved responses",
          content: { "application/json": { schema: resolver(savedResponseListSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", savedResponseCommunityParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")

      const moderate = await getCommunityAuthz(db).canModerate(
        communityId,
        user.id,
        "posts_comments",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot view saved responses")

      const responses = await fetchModSavedResponse(db).getManyForCommunity(communityId, [
        "id",
        "title",
        "bodyMd",
      ])
      return c.json({ data: responses })
    },
  )
  .post(
    "/:communityId",
    describeRoute({
      description: "Create a saved response (moderators with posts_comments permission)",
      responses: {
        201: {
          description: "Saved response created",
          content: { "application/json": { schema: resolver(savedResponseCreateSchemaResponse) } },
        },
        400: {
          description: "Saved response cap reached",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", savedResponseCommunityParam),
    validator("json", savedResponseCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      const moderate = await getCommunityAuthz(db).canModerate(
        communityId,
        user.id,
        "posts_comments",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot manage saved responses")

      const count = await fetchModSavedResponse(db).countForCommunity(communityId)
      if (count >= SAVED_RESPONSE_CAP) {
        return throwBadRequest(c, "Saved response limit reached")
      }

      const response = await crudModSavedResponse(db).create({
        communityId,
        title: body.title,
        bodyMd: body.bodyMd,
        createdByUserId: user.id,
      })
      return c.json({ id: response.id }, 201)
    },
  )
  .patch(
    "/response/:id",
    describeRoute({
      description: "Update a saved response (moderators with posts_comments permission)",
      responses: {
        200: {
          description: "Saved response updated",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Saved response not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", savedResponseIdParam),
    validator("json", savedResponseUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const response = await fetchModSavedResponse(db).getOne(id, ["communityId"])
      if (!response) return throwNotFound(c, "Saved response not found")

      const moderate = await getCommunityAuthz(db).canModerate(
        response.communityId,
        user.id,
        "posts_comments",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot manage saved responses")

      await crudModSavedResponse(db).update(id, body)
      return c.json({})
    },
  )
  .delete(
    "/response/:id",
    describeRoute({
      description: "Delete a saved response (moderators with posts_comments permission)",
      responses: {
        200: {
          description: "Saved response deleted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Saved response not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", savedResponseIdParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const response = await fetchModSavedResponse(db).getOne(id, ["communityId"])
      if (!response) return throwNotFound(c, "Saved response not found")

      const moderate = await getCommunityAuthz(db).canModerate(
        response.communityId,
        user.id,
        "posts_comments",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot manage saved responses")

      await crudModSavedResponse(db).deleteOne(id)
      return c.json({})
    },
  )

export default app
