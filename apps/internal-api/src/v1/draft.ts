import { crudPostDraft } from "@lib/dao/postDraft/crud"
import { fetchPostDraft } from "@lib/dao/postDraft/fetch"
import { db } from "@template-nextjs/db"
import type { Selectable } from "kysely"
import type { DB } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwNotFound } from "../utils/http-exception"
import {
  draftCreateSchemaRequest,
  draftCreateSchemaResponse,
  draftIdSchemaParam,
  draftListSchemaResponse,
  draftSchemaResponse,
  draftUpdateSchemaRequest,
} from "./draft.serializer"

const DRAFT_CAP = 20

function serializeDraft(draft: Selectable<DB["postDraft"]>) {
  return {
    id: draft.id,
    communityId: draft.communityId,
    isProfile: draft.isProfile,
    type: draft.type,
    title: draft.title,
    bodyMd: draft.bodyMd,
    linkUrl: draft.linkUrl,
    isNsfw: draft.isNsfw,
    isSpoiler: draft.isSpoiler,
    isOc: draft.isOc,
    flairTemplateId: draft.flairTemplateId,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  }
}

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/",
    describeRoute({
      description: "List the current user's drafts, newest updated first",
      responses: {
        200: {
          description: "Drafts",
          content: { "application/json": { schema: resolver(draftListSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const drafts = await fetchPostDraft(db).listForUser(user.id)
      return c.json({
        data: drafts.map(serializeDraft),
        count: drafts.length,
        max: DRAFT_CAP,
      })
    },
  )
  .post(
    "/",
    describeRoute({
      description: "Create a draft",
      responses: {
        201: {
          description: "Draft created",
          content: { "application/json": { schema: resolver(draftCreateSchemaResponse) } },
        },
        400: {
          description: "Draft limit reached",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", draftCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      const count = await fetchPostDraft(db).countForUser(user.id)
      if (count >= DRAFT_CAP) {
        return throwBadRequest(
          c,
          `You can only keep ${DRAFT_CAP} drafts. Delete one before creating another.`,
        )
      }

      const created = await crudPostDraft(db).create({ userId: user.id, ...body })
      return c.json({ id: created.id }, 201)
    },
  )
  .get(
    "/:id",
    describeRoute({
      description: "Get a single draft",
      responses: {
        200: {
          description: "Draft",
          content: { "application/json": { schema: resolver(draftSchemaResponse) } },
        },
        404: {
          description: "Draft not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", draftIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const draft = await fetchPostDraft(db).getOne(id, [
        "id",
        "userId",
        "communityId",
        "isProfile",
        "type",
        "title",
        "bodyMd",
        "linkUrl",
        "isNsfw",
        "isSpoiler",
        "isOc",
        "flairTemplateId",
        "createdAt",
        "updatedAt",
      ])
      if (!draft || draft.userId !== user.id) return throwNotFound(c, "Draft not found")

      return c.json(serializeDraft(draft))
    },
  )
  .patch(
    "/:id",
    describeRoute({
      description: "Update a draft",
      responses: {
        200: {
          description: "Draft updated",
          content: { "application/json": { schema: resolver(draftSchemaResponse) } },
        },
        404: {
          description: "Draft not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", draftIdSchemaParam),
    validator("json", draftUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const updated = await crudPostDraft(db).update(id, user.id, body)
      if (!updated) return throwNotFound(c, "Draft not found")

      return c.json(serializeDraft(updated))
    },
  )
  .delete(
    "/:id",
    describeRoute({
      description: "Delete a draft",
      responses: {
        200: {
          description: "Draft deleted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        404: {
          description: "Draft not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", draftIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const deleted = await crudPostDraft(db).deleteOwn(id, user.id)
      if (!deleted) return throwNotFound(c, "Draft not found")

      return c.json({})
    },
  )

export default app
