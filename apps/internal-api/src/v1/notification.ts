import {
  crudNotification,
  crudUserNotificationPreference,
  fetchNotification,
  fetchUserNotificationPreference,
  NOTIFICATION_TYPES,
  type NotificationCursor,
  type NotificationType,
} from "@lib/dao"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse, IdParamT } from "../utils/common.serializer"
import { throwBadRequest } from "../utils/http-exception"
import {
  notificationListSchemaQuery,
  notificationListSchemaResponse,
  notificationPreferencesSchemaResponse,
  notificationPreferenceUpdateSchemaRequest,
  notificationUnreadCountSchemaResponse,
} from "./notification.serializer"

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value)
}

function encodeCursor(cursor: NotificationCursor): string {
  return Buffer.from(JSON.stringify({ c: cursor.createdAt.toISOString(), i: cursor.id })).toString(
    "base64url",
  )
}

function decodeCursor(raw: string | null): NotificationCursor | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8")) as {
      c?: string
      i?: string
    }
    if (!parsed.c || !parsed.i) return null
    const createdAt = new Date(parsed.c)
    if (Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id: parsed.i }
  } catch {
    return null
  }
}

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/",
    describeRoute({
      description: "List the current user's notifications, newest first",
      responses: {
        200: {
          description: "Notifications",
          content: { "application/json": { schema: resolver(notificationListSchemaResponse) } },
        },
      },
    }),
    validator("query", notificationListSchemaQuery),
    async (c) => {
      const user = c.var.user
      const query = c.req.valid("query")
      const limit = Math.min(query.limit ?? PAGE_SIZE, MAX_PAGE_SIZE)
      const before = decodeCursor(query.cursor ?? null)

      const rows = await fetchNotification(db).list(user.id, { before, limit: limit + 1 })
      const hasMore = rows.length > limit
      const page = hasMore ? rows.slice(0, limit) : rows
      const last = page.at(-1)
      const nextCursor =
        hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null

      return c.json({
        data: page.map((n) => ({
          id: n.id,
          type: n.type,
          actorUserId: n.actorUserId,
          postId: n.postId,
          commentId: n.commentId,
          communityId: n.communityId,
          conversationId: n.conversationId,
          previewSnapshot: n.previewSnapshot,
          isRead: n.readAt !== null,
          createdAt: n.createdAt.toISOString(),
        })),
        nextCursor,
      })
    },
  )
  .get(
    "/unread-count",
    describeRoute({
      description: "Number of unread, unarchived notifications",
      responses: {
        200: {
          description: "Unread count",
          content: {
            "application/json": { schema: resolver(notificationUnreadCountSchemaResponse) },
          },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const count = await fetchNotification(db).unreadCount(user.id)
      return c.json({ count })
    },
  )
  .get(
    "/preferences",
    describeRoute({
      description: "List notification preferences for every type, with defaults merged in",
      responses: {
        200: {
          description: "Preferences",
          content: {
            "application/json": { schema: resolver(notificationPreferencesSchemaResponse) },
          },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const data = await fetchUserNotificationPreference(db).listForUser(user.id)
      return c.json({ data })
    },
  )
  .put(
    "/preferences",
    describeRoute({
      description: "Set the notification level for a type (all is stored but delivered as inbox)",
      responses: {
        200: {
          description: "Preference updated",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        400: {
          description: "Invalid type or level",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", notificationPreferenceUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { type, level } = c.req.valid("json")
      if (!isNotificationType(type)) {
        return throwBadRequest(c, "Unknown notification type")
      }
      await crudUserNotificationPreference(db).upsert(user.id, type, level)
      return c.json({})
    },
  )
  .post(
    "/read-all",
    describeRoute({
      description: "Mark all of the current user's notifications as read",
      responses: {
        200: {
          description: "Marked read",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      await crudNotification(db).markAllRead(user.id)
      return c.json({})
    },
  )
  .post(
    "/:id/read",
    describeRoute({
      description: "Mark a single notification as read",
      responses: {
        200: {
          description: "Marked read",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      await crudNotification(db).markRead(id, user.id)
      return c.json({})
    },
  )
  .post(
    "/:id/archive",
    describeRoute({
      description: "Archive a single notification",
      responses: {
        200: {
          description: "Archived",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      await crudNotification(db).archive(id, user.id)
      return c.json({})
    },
  )

export default app
