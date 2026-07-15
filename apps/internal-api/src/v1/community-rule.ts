import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudCommunityRule } from "@lib/dao/communityRule/crud"
import { fetchCommunityRule } from "@lib/dao/communityRule/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  ruleCommunityIdSchemaParam,
  ruleCreateSchemaRequest,
  ruleCreateSchemaResponse,
  ruleIdSchemaParam,
  ruleListSchemaResponse,
  ruleReorderSchemaRequest,
  ruleUpdateSchemaRequest,
} from "./community-rule.serializer"

const app = new Hono()
  .get(
    "/:communityId",
    authNoThrowMiddleware,
    describeRoute({
      description: "List a community's rules",
      responses: {
        200: {
          description: "Community rules",
          content: {
            "application/json": {
              schema: resolver(ruleListSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", ruleCommunityIdSchemaParam),
    async (c) => {
      const { communityId } = c.req.valid("param")
      const rules = await fetchCommunityRule(db).getManyForCommunity(communityId, [
        "id",
        "name",
        "description",
        "position",
      ])
      return c.json({
        data: rules.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          position: r.position,
        })),
      })
    },
  )
  .use(authMiddleware)
  .post(
    "/:communityId",
    describeRoute({
      description: "Create a rule (moderators with config permission)",
      responses: {
        201: {
          description: "Rule created",
          content: {
            "application/json": {
              schema: resolver(ruleCreateSchemaResponse),
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
    validator("param", ruleCommunityIdSchemaParam),
    validator("json", ruleCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage rules for this community")

      const existing = await fetchCommunityRule(db).getManyForCommunity(communityId, ["id"])
      const rule = await crudCommunityRule(db).create({
        communityId,
        name: body.name,
        description: body.description ?? null,
        position: existing.length,
      })

      return c.json({ id: rule.id }, 201)
    },
  )
  .patch(
    "/:id",
    describeRoute({
      description: "Update a rule (moderators with config permission)",
      responses: {
        200: {
          description: "Rule updated",
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
          description: "Rule not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", ruleIdSchemaParam),
    validator("json", ruleUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const rule = await fetchCommunityRule(db).getOne(id, ["communityId"])
      if (!rule) return throwNotFound(c, "Rule not found")

      const moderate = await getCommunityAuthz(db).canModerate(rule.communityId, user.id, "config")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage rules for this community")

      await crudCommunityRule(db).update(id, body)
      return c.json({})
    },
  )
  .delete(
    "/:id",
    describeRoute({
      description: "Delete a rule (moderators with config permission)",
      responses: {
        200: {
          description: "Rule deleted",
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
          description: "Rule not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", ruleIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const rule = await fetchCommunityRule(db).getOne(id, ["communityId"])
      if (!rule) return throwNotFound(c, "Rule not found")

      const moderate = await getCommunityAuthz(db).canModerate(rule.communityId, user.id, "config")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage rules for this community")

      await crudCommunityRule(db).deleteOne(id)
      return c.json({})
    },
  )
  .put(
    "/:communityId/reorder",
    describeRoute({
      description: "Reorder a community's rules (moderators with config permission)",
      responses: {
        200: {
          description: "Rules reordered",
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
      },
    }),
    validator("param", ruleCommunityIdSchemaParam),
    validator("json", ruleReorderSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage rules for this community")

      await crudCommunityRule(db).reorder(communityId, body.orderedIds)
      return c.json({})
    },
  )

export default app
