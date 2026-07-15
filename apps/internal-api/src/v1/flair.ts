import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudCommunityUserFlair } from "@lib/dao/communityUserFlair/crud"
import { crudPostFlairTemplate } from "@lib/dao/postFlairTemplate/crud"
import { fetchPostFlairTemplate } from "@lib/dao/postFlairTemplate/fetch"
import { crudUserFlairTemplate } from "@lib/dao/userFlairTemplate/crud"
import { fetchUserFlairTemplate } from "@lib/dao/userFlairTemplate/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  flairCommunityIdSchemaParam,
  flairCreateSchemaResponse,
  flairIdSchemaParam,
  myFlairSchemaRequest,
  postFlairCreateSchemaRequest,
  postFlairListSchemaResponse,
  postFlairUpdateSchemaRequest,
  userFlairCreateSchemaRequest,
  userFlairListSchemaResponse,
  userFlairUpdateSchemaRequest,
} from "./flair.serializer"

const FLAIR_CAP = 350

const app = new Hono()
  .get(
    "/:communityId/post-templates",
    authNoThrowMiddleware,
    describeRoute({
      description: "List a community's post flair templates",
      responses: {
        200: {
          description: "Post flair templates",
          content: {
            "application/json": {
              schema: resolver(postFlairListSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", flairCommunityIdSchemaParam),
    async (c) => {
      const { communityId } = c.req.valid("param")
      const templates = await fetchPostFlairTemplate(db).getManyForCommunity(communityId, [
        "id",
        "text",
        "bgColor",
        "textColor",
        "modOnly",
        "position",
      ])
      return c.json({
        data: templates.map((t) => ({
          id: t.id,
          text: t.text,
          bgColor: t.bgColor,
          textColor: t.textColor,
          modOnly: t.modOnly,
          position: t.position,
        })),
      })
    },
  )
  .get(
    "/:communityId/user-templates",
    authNoThrowMiddleware,
    describeRoute({
      description: "List a community's user flair templates",
      responses: {
        200: {
          description: "User flair templates",
          content: {
            "application/json": {
              schema: resolver(userFlairListSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", flairCommunityIdSchemaParam),
    async (c) => {
      const { communityId } = c.req.valid("param")
      const templates = await fetchUserFlairTemplate(db).getManyForCommunity(communityId, [
        "id",
        "text",
        "bgColor",
        "textColor",
        "modOnly",
        "selfAssignable",
        "position",
      ])
      return c.json({
        data: templates.map((t) => ({
          id: t.id,
          text: t.text,
          bgColor: t.bgColor,
          textColor: t.textColor,
          modOnly: t.modOnly,
          selfAssignable: t.selfAssignable,
          position: t.position,
        })),
      })
    },
  )
  .use(authMiddleware)
  .post(
    "/:communityId/post-templates",
    describeRoute({
      description: "Create a post flair template (moderators with flair permission)",
      responses: {
        201: {
          description: "Post flair template created",
          content: {
            "application/json": {
              schema: resolver(flairCreateSchemaResponse),
            },
          },
        },
        400: {
          description: "Flair cap reached",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
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
    validator("param", flairCommunityIdSchemaParam),
    validator("json", postFlairCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "flair")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage flair for this community")

      const count = await fetchPostFlairTemplate(db).countForCommunity(communityId)
      if (count >= FLAIR_CAP) return throwBadRequest(c, "Post flair template limit reached")

      const template = await crudPostFlairTemplate(db).create({
        communityId,
        text: body.text,
        bgColor: body.bgColor ?? null,
        textColor: body.textColor ?? null,
        modOnly: body.modOnly ?? false,
        position: count,
      })
      return c.json({ id: template.id }, 201)
    },
  )
  .patch(
    "/post-templates/:id",
    describeRoute({
      description: "Update a post flair template (moderators with flair permission)",
      responses: {
        200: {
          description: "Post flair template updated",
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
          description: "Post flair template not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", flairIdSchemaParam),
    validator("json", postFlairUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const template = await fetchPostFlairTemplate(db).getOne(id, ["communityId"])
      if (!template) return throwNotFound(c, "Post flair template not found")

      const moderate = await getCommunityAuthz(db).canModerate(
        template.communityId,
        user.id,
        "flair",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot manage flair for this community")

      await crudPostFlairTemplate(db).update(id, body)
      return c.json({})
    },
  )
  .delete(
    "/post-templates/:id",
    describeRoute({
      description: "Delete a post flair template (moderators with flair permission)",
      responses: {
        200: {
          description: "Post flair template deleted",
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
          description: "Post flair template not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", flairIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const template = await fetchPostFlairTemplate(db).getOne(id, ["communityId"])
      if (!template) return throwNotFound(c, "Post flair template not found")

      const moderate = await getCommunityAuthz(db).canModerate(
        template.communityId,
        user.id,
        "flair",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot manage flair for this community")

      await crudPostFlairTemplate(db).deleteOne(id)
      return c.json({})
    },
  )
  .post(
    "/:communityId/user-templates",
    describeRoute({
      description: "Create a user flair template (moderators with flair permission)",
      responses: {
        201: {
          description: "User flair template created",
          content: {
            "application/json": {
              schema: resolver(flairCreateSchemaResponse),
            },
          },
        },
        400: {
          description: "Flair cap reached",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
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
    validator("param", flairCommunityIdSchemaParam),
    validator("json", userFlairCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "flair")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage flair for this community")

      const count = await fetchUserFlairTemplate(db).countForCommunity(communityId)
      if (count >= FLAIR_CAP) return throwBadRequest(c, "User flair template limit reached")

      const template = await crudUserFlairTemplate(db).create({
        communityId,
        text: body.text,
        bgColor: body.bgColor ?? null,
        textColor: body.textColor ?? null,
        modOnly: body.modOnly ?? false,
        selfAssignable: body.selfAssignable ?? true,
        position: count,
      })
      return c.json({ id: template.id }, 201)
    },
  )
  .patch(
    "/user-templates/:id",
    describeRoute({
      description: "Update a user flair template (moderators with flair permission)",
      responses: {
        200: {
          description: "User flair template updated",
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
          description: "User flair template not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", flairIdSchemaParam),
    validator("json", userFlairUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const template = await fetchUserFlairTemplate(db).getOne(id, ["communityId"])
      if (!template) return throwNotFound(c, "User flair template not found")

      const moderate = await getCommunityAuthz(db).canModerate(
        template.communityId,
        user.id,
        "flair",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot manage flair for this community")

      await crudUserFlairTemplate(db).update(id, body)
      return c.json({})
    },
  )
  .delete(
    "/user-templates/:id",
    describeRoute({
      description: "Delete a user flair template (moderators with flair permission)",
      responses: {
        200: {
          description: "User flair template deleted",
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
          description: "User flair template not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", flairIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const template = await fetchUserFlairTemplate(db).getOne(id, ["communityId"])
      if (!template) return throwNotFound(c, "User flair template not found")

      const moderate = await getCommunityAuthz(db).canModerate(
        template.communityId,
        user.id,
        "flair",
      )
      if (!moderate.ok) return throwForbidden(c, "You cannot manage flair for this community")

      await crudUserFlairTemplate(db).deleteOne(id)
      return c.json({})
    },
  )
  .put(
    "/:communityId/my-flair",
    describeRoute({
      description: "Set or clear the current user's flair in a community",
      responses: {
        200: {
          description: "User flair updated",
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
          description: "Flair template not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", flairCommunityIdSchemaParam),
    validator("json", myFlairSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      const isMember = await getCommunityAuthz(db).isMember(communityId, user.id)
      if (!isMember) return throwForbidden(c, "You are not a member of this community")

      const templateId = body.userFlairTemplateId ?? null
      const customText = body.customText ?? null

      if (!templateId && !customText) {
        await crudCommunityUserFlair(db).clear(communityId, user.id)
        return c.json({})
      }

      if (templateId) {
        const template = await fetchUserFlairTemplate(db).getOne(templateId, [
          "communityId",
          "selfAssignable",
        ])
        if (!template || template.communityId !== communityId) {
          return throwNotFound(c, "Flair template not found")
        }
        if (!template.selfAssignable) {
          return throwForbidden(c, "This flair is not self-assignable")
        }
      }

      await crudCommunityUserFlair(db).upsert(communityId, user.id, templateId, customText)
      return c.json({})
    },
  )

export default app
