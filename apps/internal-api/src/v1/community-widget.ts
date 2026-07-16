import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { crudCommunityBookmark } from "@lib/dao/communityBookmark/crud"
import { fetchCommunityBookmark } from "@lib/dao/communityBookmark/fetch"
import { crudCommunityRelated } from "@lib/dao/communityRelated/crud"
import { fetchCommunityRelated } from "@lib/dao/communityRelated/fetch"
import { crudCommunityWidget } from "@lib/dao/communityWidget/crud"
import { fetchCommunityWidget } from "@lib/dao/communityWidget/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { ErrorCode } from "../utils/errors.enum"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  bookmarkCreateSchemaRequest,
  bookmarkUpdateSchemaRequest,
  communityWidgetsSchemaResponse,
  relatedSetSchemaRequest,
  widgetCommunityIdSchemaParam,
  widgetCommunityNameSchemaParam,
  widgetCreateSchemaResponse,
  widgetIdSchemaParam,
  widgetReorderSchemaRequest,
  widgetTextCreateSchemaRequest,
  widgetTextUpdateSchemaRequest,
} from "./community-widget.serializer"

async function requireConfigMod(communityId: string, userId: string): Promise<boolean> {
  const moderate = await getCommunityAuthz(db).canModerate(communityId, userId, "config")
  return moderate.ok
}

const app = new Hono()
  .get(
    "/:communityName",
    authNoThrowMiddleware,
    describeRoute({
      description: "A community's bookmarks, text widgets, and related communities",
      responses: {
        200: {
          description: "Community widgets",
          content: { "application/json": { schema: resolver(communityWidgetsSchemaResponse) } },
        },
        404: {
          description: "Community not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", widgetCommunityNameSchemaParam),
    async (c) => {
      const user = c.var.user
      const { communityName } = c.req.valid("param")

      const community = await fetchCommunity(db).getOneByName(communityName, ["id", "visibility"])
      if (!community) return throwNotFound(c, "Community not found")

      const view = await getCommunityAuthz(db).canView(
        { id: community.id, visibility: community.visibility },
        user?.id ?? null,
      )
      if (!view.ok) return throwNotFound(c, "Community not found")

      const [bookmarks, widgets, related] = await Promise.all([
        fetchCommunityBookmark(db).listForCommunity(community.id, [
          "id",
          "label",
          "url",
          "position",
        ]),
        fetchCommunityWidget(db).listForCommunity(community.id, [
          "id",
          "title",
          "bodyMd",
          "position",
        ]),
        fetchCommunityRelated(db).listForCommunity(community.id),
      ])

      return c.json({
        bookmarks,
        widgets,
        related: related.map((r) => ({
          id: r.id,
          name: r.name,
          displayName: r.displayName,
          iconImageKey: r.iconImageKey,
          memberCount: r.memberCount,
        })),
      })
    },
  )
  .use(authMiddleware)
  .post(
    "/:communityId/bookmark",
    describeRoute({
      description: "Add a community bookmark (moderators with config permission)",
      responses: {
        201: {
          description: "Bookmark created",
          content: { "application/json": { schema: resolver(widgetCreateSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", widgetCommunityIdSchemaParam),
    validator("json", bookmarkCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      if (!(await requireConfigMod(communityId, user.id))) {
        return throwForbidden(c, "You cannot manage this community")
      }

      const existing = await fetchCommunityBookmark(db).listForCommunity(communityId, ["id"])
      const bookmark = await crudCommunityBookmark(db).create({
        communityId,
        label: body.label,
        url: body.url,
        position: existing.length,
      })
      return c.json({ id: bookmark.id }, 201)
    },
  )
  .patch(
    "/bookmark/:id",
    describeRoute({
      description: "Update a community bookmark (moderators with config permission)",
      responses: {
        200: {
          description: "Bookmark updated",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Bookmark not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", widgetIdSchemaParam),
    validator("json", bookmarkUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const bookmark = await fetchCommunityBookmark(db).getOne(id, ["communityId"])
      if (!bookmark) return throwNotFound(c, "Bookmark not found")
      if (!(await requireConfigMod(bookmark.communityId, user.id))) {
        return throwForbidden(c, "You cannot manage this community")
      }

      await crudCommunityBookmark(db).update(id, body)
      return c.json({})
    },
  )
  .delete(
    "/bookmark/:id",
    describeRoute({
      description: "Delete a community bookmark (moderators with config permission)",
      responses: {
        200: {
          description: "Bookmark deleted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Bookmark not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", widgetIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const bookmark = await fetchCommunityBookmark(db).getOne(id, ["communityId"])
      if (!bookmark) return throwNotFound(c, "Bookmark not found")
      if (!(await requireConfigMod(bookmark.communityId, user.id))) {
        return throwForbidden(c, "You cannot manage this community")
      }

      await crudCommunityBookmark(db).deleteOne(id)
      return c.json({})
    },
  )
  .put(
    "/:communityId/bookmark/reorder",
    describeRoute({
      description: "Reorder community bookmarks (moderators with config permission)",
      responses: {
        200: {
          description: "Bookmarks reordered",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", widgetCommunityIdSchemaParam),
    validator("json", widgetReorderSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      if (!(await requireConfigMod(communityId, user.id))) {
        return throwForbidden(c, "You cannot manage this community")
      }

      await crudCommunityBookmark(db).reorder(communityId, body.orderedIds)
      return c.json({})
    },
  )
  .post(
    "/:communityId/widget",
    describeRoute({
      description: "Add a text widget (moderators with config permission)",
      responses: {
        201: {
          description: "Widget created",
          content: { "application/json": { schema: resolver(widgetCreateSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", widgetCommunityIdSchemaParam),
    validator("json", widgetTextCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      if (!(await requireConfigMod(communityId, user.id))) {
        return throwForbidden(c, "You cannot manage this community")
      }

      const existing = await fetchCommunityWidget(db).listForCommunity(communityId, ["id"])
      const widget = await crudCommunityWidget(db).create({
        communityId,
        title: body.title,
        bodyMd: body.body,
        position: existing.length,
      })
      return c.json({ id: widget.id }, 201)
    },
  )
  .patch(
    "/widget/:id",
    describeRoute({
      description: "Update a text widget (moderators with config permission)",
      responses: {
        200: {
          description: "Widget updated",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Widget not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", widgetIdSchemaParam),
    validator("json", widgetTextUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const widget = await fetchCommunityWidget(db).getOne(id, ["communityId"])
      if (!widget) return throwNotFound(c, "Widget not found")
      if (!(await requireConfigMod(widget.communityId, user.id))) {
        return throwForbidden(c, "You cannot manage this community")
      }

      const data: { title?: string; bodyMd?: string } = {}
      if (body.title !== undefined) data.title = body.title
      if (body.body !== undefined) data.bodyMd = body.body
      await crudCommunityWidget(db).update(id, data)
      return c.json({})
    },
  )
  .delete(
    "/widget/:id",
    describeRoute({
      description: "Delete a text widget (moderators with config permission)",
      responses: {
        200: {
          description: "Widget deleted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Widget not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", widgetIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const widget = await fetchCommunityWidget(db).getOne(id, ["communityId"])
      if (!widget) return throwNotFound(c, "Widget not found")
      if (!(await requireConfigMod(widget.communityId, user.id))) {
        return throwForbidden(c, "You cannot manage this community")
      }

      await crudCommunityWidget(db).deleteOne(id)
      return c.json({})
    },
  )
  .put(
    "/:communityId/widget/reorder",
    describeRoute({
      description: "Reorder text widgets (moderators with config permission)",
      responses: {
        200: {
          description: "Widgets reordered",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", widgetCommunityIdSchemaParam),
    validator("json", widgetReorderSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      if (!(await requireConfigMod(communityId, user.id))) {
        return throwForbidden(c, "You cannot manage this community")
      }

      await crudCommunityWidget(db).reorder(communityId, body.orderedIds)
      return c.json({})
    },
  )
  .put(
    "/:communityId/related",
    describeRoute({
      description: "Set the related communities list (moderators with config permission)",
      responses: {
        200: {
          description: "Related communities set",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        400: {
          description: "Invalid related communities",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", widgetCommunityIdSchemaParam),
    validator("json", relatedSetSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      if (!(await requireConfigMod(communityId, user.id))) {
        return throwForbidden(c, "You cannot manage this community")
      }

      const unique = [...new Set(body.communityIds)].filter((id) => id !== communityId)
      if (unique.length > 0) {
        const found = await fetchCommunity(db).getManyByIds(unique, ["id"])
        if (found.length !== unique.length) {
          return throwBadRequest(
            c,
            "One or more communities do not exist",
            ErrorCode.ValidationFailed,
          )
        }
      }

      await crudCommunityRelated(db).setList(communityId, unique)
      return c.json({})
    },
  )

export default app
