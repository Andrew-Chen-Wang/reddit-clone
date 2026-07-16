import { crudChatConversation } from "@lib/dao/chatConversation/crud"
import { fetchChatConversation } from "@lib/dao/chatConversation/fetch"
import { crudChatMessage } from "@lib/dao/chatMessage/crud"
import { fetchChatMessage } from "@lib/dao/chatMessage/fetch"
import { crudChatParticipant } from "@lib/dao/chatParticipant/crud"
import { fetchChatParticipant } from "@lib/dao/chatParticipant/fetch"
import { emitChatRequest } from "@lib/dao/notification/emit-helpers"
import { fetchUser } from "@lib/dao/user/fetch"
import { fetchUserBlock } from "@lib/dao/userBlock/fetch"
import { fetchUserSettings } from "@lib/dao/userSettings/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  chatConversationCreatedSchemaResponse,
  chatConversationIdSchemaParam,
  chatConversationSchemaResponse,
  chatDmSchemaRequest,
  chatGroupSchemaRequest,
  chatListSchemaQuery,
  chatMessageIdSchemaParam,
  chatMessageSchemaRequest,
  chatMessageSchemaResponse,
  chatMessagesSchemaQuery,
  chatMessagesSchemaResponse,
  chatParticipantSchemaParam,
  chatRenameSchemaRequest,
  chatUnreadCountSchemaResponse,
} from "./chat.serializer"

const MAX_GROUP_PARTICIPANTS = 20
const MESSAGE_PAGE_SIZE = 30
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

const encodeCursor = (d: Date): string => Buffer.from(d.toISOString()).toString("base64url")

const decodeCursor = (cursor: string | null): Date | null => {
  if (!cursor) return null
  try {
    const parsed = new Date(Buffer.from(cursor, "base64url").toString("utf-8"))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  } catch {
    return null
  }
}

const toItem = (m: {
  id: string
  conversationId: string
  senderUserId: string | null
  body: string
  deletedAt: Date | null
  createdAt: Date
}) => ({
  id: m.id,
  conversationId: m.conversationId,
  senderUserId: m.senderUserId,
  body: m.deletedAt ? null : m.body,
  isDeleted: m.deletedAt !== null,
  createdAt: m.createdAt.toISOString(),
})

async function serializeConversations(
  userId: string,
  rows: Awaited<ReturnType<ReturnType<typeof fetchChatConversation>["listForUser"]>>,
) {
  const ids = rows.map((r) => r.id)
  const participants = await fetchChatConversation(db).listParticipants(ids)
  const lastMessages = await fetchChatConversation(db).lastMessages(ids)
  const unread = await fetchChatConversation(db).unreadCounts(userId, ids)

  const participantsByConv = new Map<string, typeof participants>()
  for (const p of participants) {
    const list = participantsByConv.get(p.conversationId) ?? []
    list.push(p)
    participantsByConv.set(p.conversationId, list)
  }
  const lastByConv = new Map<string, (typeof lastMessages)[number]>()
  for (const m of lastMessages) lastByConv.set(m.conversationId, m)

  return rows.map((r) => {
    const last = lastByConv.get(r.id)
    return {
      id: r.id,
      isGroup: r.isGroup,
      name: r.name,
      createdByUserId: r.createdByUserId,
      lastMessageAt: r.lastMessageAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      myStatus: r.myStatus,
      myRole: r.myRole,
      unreadCount: unread.get(r.id) ?? 0,
      lastMessage: last
        ? {
            id: last.id,
            body: last.deletedAt ? null : last.body,
            senderUserId: last.senderUserId,
            isDeleted: last.deletedAt !== null,
            createdAt: last.createdAt.toISOString(),
          }
        : null,
      participants: (participantsByConv.get(r.id) ?? []).map((p) => ({
        userId: p.userId,
        username: p.username,
        displayName: p.displayName,
        avatarImageKey: p.avatarImageKey,
        role: p.role,
        status: p.status,
      })),
    }
  })
}

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/",
    describeRoute({
      description: "List the current user's chat conversations",
      responses: {
        200: {
          description: "Conversations",
          content: { "application/json": { schema: resolver(chatConversationSchemaResponse) } },
        },
      },
    }),
    validator("query", chatListSchemaQuery),
    async (c) => {
      const user = c.var.user
      const filter = c.req.valid("query").filter ?? "all"
      const rows = await fetchChatConversation(db).listForUser(user.id, filter)
      let serialized = await serializeConversations(user.id, rows)
      if (filter === "unread") serialized = serialized.filter((s) => s.unreadCount > 0)
      return c.json({ data: serialized })
    },
  )
  .get(
    "/unread-count",
    describeRoute({
      description: "Total number of conversations with unread messages",
      responses: {
        200: {
          description: "Unread conversation count",
          content: { "application/json": { schema: resolver(chatUnreadCountSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const count = await fetchChatConversation(db).countUnreadConversations(user.id)
      return c.json({ count })
    },
  )
  .post(
    "/dm",
    describeRoute({
      description: "Create or reuse a direct message conversation and send the first message",
      responses: {
        201: {
          description: "Conversation",
          content: {
            "application/json": { schema: resolver(chatConversationCreatedSchemaResponse) },
          },
        },
        403: {
          description: "Not allowed to message this user",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Recipient not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", chatDmSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { username, body } = c.req.valid("json")

      const recipient = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!recipient) return throwNotFound(c, "User not found")
      if (recipient.id === user.id) return throwBadRequest(c, "You cannot message yourself")

      if (await fetchUserBlock(db).isBlockedEither(user.id, recipient.id)) {
        return throwForbidden(c, "You cannot message this user")
      }

      const now = new Date()
      const existing = await fetchChatConversation(db).findExistingDm(user.id, recipient.id)
      if (existing) {
        await crudChatMessage(db).create({ conversationId: existing, senderUserId: user.id, body })
        await crudChatConversation(db).touch(existing, now)
        return c.json({ conversationId: existing }, 201)
      }

      const settings = await fetchUserSettings(db).getOne(recipient.id, ["chatRequestPolicy"])
      const policy = settings?.chatRequestPolicy ?? "everyone"
      if (policy === "nobody") return throwForbidden(c, "This user is not accepting chat requests")
      if (policy === "accounts_30d") {
        const sender = await fetchUser(db).getOne(user.id, ["createdAt"])
        const ageMs = sender ? now.getTime() - sender.createdAt.getTime() : 0
        if (ageMs < THIRTY_DAYS_MS) {
          return throwForbidden(c, "Your account is too new to message this user")
        }
      }

      const conversation = await crudChatConversation(db).create({
        isGroup: false,
        createdByUserId: user.id,
        lastMessageAt: now,
      })
      await crudChatParticipant(db).createMany([
        { conversationId: conversation.id, userId: user.id, role: "member", status: "accepted" },
        {
          conversationId: conversation.id,
          userId: recipient.id,
          role: "member",
          status: "pending",
        },
      ])
      await crudChatMessage(db).create({
        conversationId: conversation.id,
        senderUserId: user.id,
        body,
      })
      await emitChatRequest(db, {
        recipientUserId: recipient.id,
        actorUserId: user.id,
        conversationId: conversation.id,
      })
      return c.json({ conversationId: conversation.id }, 201)
    },
  )
  .post(
    "/group",
    describeRoute({
      description: "Create a group chat and send the first message",
      responses: {
        201: {
          description: "Conversation",
          content: {
            "application/json": { schema: resolver(chatConversationCreatedSchemaResponse) },
          },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", chatGroupSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { name, usernames, body } = c.req.valid("json")

      const seen = new Set<string>()
      const inviteeIds: string[] = []
      for (const username of usernames) {
        const target = await fetchUser(db).getOneByUsername(username, ["id"])
        if (!target || target.id === user.id || seen.has(target.id)) continue
        if (await fetchUserBlock(db).isBlockedEither(user.id, target.id)) continue
        seen.add(target.id)
        inviteeIds.push(target.id)
      }
      if (inviteeIds.length === 0) return throwBadRequest(c, "No valid participants to invite")
      if (inviteeIds.length + 1 > MAX_GROUP_PARTICIPANTS) {
        return throwBadRequest(c, `A group chat can have at most ${MAX_GROUP_PARTICIPANTS} members`)
      }

      const now = new Date()
      const conversation = await crudChatConversation(db).create({
        isGroup: true,
        name,
        createdByUserId: user.id,
        lastMessageAt: now,
      })
      await crudChatParticipant(db).createMany([
        { conversationId: conversation.id, userId: user.id, role: "host", status: "accepted" },
        ...inviteeIds.map((userId) => ({
          conversationId: conversation.id,
          userId,
          role: "member",
          status: "accepted",
        })),
      ])
      await crudChatMessage(db).create({
        conversationId: conversation.id,
        senderUserId: user.id,
        body,
      })
      return c.json({ conversationId: conversation.id }, 201)
    },
  )
  .get(
    "/:conversationId/messages",
    describeRoute({
      description: "Fetch messages for a conversation (polling via ?after, backscroll via ?cursor)",
      responses: {
        200: {
          description: "Messages",
          content: { "application/json": { schema: resolver(chatMessagesSchemaResponse) } },
        },
        403: {
          description: "Not a participant",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", chatConversationIdSchemaParam),
    validator("query", chatMessagesSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { conversationId } = c.req.valid("param")
      const query = c.req.valid("query")

      const participant = await fetchChatParticipant(db).getOne(conversationId, user.id, ["id"])
      if (!participant) return throwForbidden(c, "You are not a participant in this conversation")

      if (query.after) {
        const anchor = await fetchChatMessage(db).getOne(query.after, [
          "createdAt",
          "conversationId",
        ])
        if (!anchor || anchor.conversationId !== conversationId) {
          return c.json({ data: [], nextCursor: null })
        }
        const rows = await fetchChatMessage(db).listAfter(
          conversationId,
          anchor.createdAt,
          query.after,
        )
        return c.json({ data: rows.map(toItem), nextCursor: null })
      }

      const limit = query.limit ?? MESSAGE_PAGE_SIZE
      const before = decodeCursor(query.cursor ?? null)
      const rows = await fetchChatMessage(db).listPage(conversationId, before, limit)
      const hasMore = rows.length > limit
      const page = rows.slice(0, limit)
      const nextCursor = hasMore ? encodeCursor(page[page.length - 1].createdAt) : null
      return c.json({ data: page.toReversed().map(toItem), nextCursor })
    },
  )
  .post(
    "/:conversationId/messages",
    describeRoute({
      description: "Send a message to a conversation",
      responses: {
        201: {
          description: "Message created",
          content: { "application/json": { schema: resolver(chatMessageSchemaResponse) } },
        },
        403: {
          description: "Not allowed to send",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", chatConversationIdSchemaParam),
    validator("json", chatMessageSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { conversationId } = c.req.valid("param")
      const { body } = c.req.valid("json")

      const participant = await fetchChatParticipant(db).getOne(conversationId, user.id, ["status"])
      if (!participant) return throwForbidden(c, "You are not a participant in this conversation")
      if (participant.status !== "accepted") {
        return throwForbidden(c, "Accept the conversation before sending messages")
      }

      const conversation = await fetchChatConversation(db).getOne(conversationId, ["isGroup"])
      if (conversation && !conversation.isGroup) {
        const others = await fetchChatParticipant(db).listForConversation(conversationId)
        const other = others.find((p) => p.userId !== user.id)
        if (other && (await fetchUserBlock(db).isBlockedEither(user.id, other.userId))) {
          return throwForbidden(c, "You cannot message this user")
        }
      }

      const now = new Date()
      const message = await crudChatMessage(db).create({
        conversationId,
        senderUserId: user.id,
        body,
      })
      await crudChatConversation(db).touch(conversationId, now)
      return c.json(
        {
          id: message.id,
          conversationId: message.conversationId,
          senderUserId: message.senderUserId,
          body: message.body,
          isDeleted: false,
          createdAt: message.createdAt.toISOString(),
        },
        201,
      )
    },
  )
  .post(
    "/:conversationId/read",
    describeRoute({
      description: "Mark a conversation as read",
      responses: {
        200: {
          description: "Marked read",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not a participant",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", chatConversationIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { conversationId } = c.req.valid("param")
      const participant = await fetchChatParticipant(db).getOne(conversationId, user.id, ["id"])
      if (!participant) return throwForbidden(c, "You are not a participant in this conversation")
      await crudChatParticipant(db).markRead(conversationId, user.id, new Date())
      return c.json({})
    },
  )
  .post(
    "/:conversationId/accept",
    describeRoute({
      description: "Accept a chat request",
      responses: {
        200: {
          description: "Accepted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not a participant",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", chatConversationIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { conversationId } = c.req.valid("param")
      const participant = await fetchChatParticipant(db).getOne(conversationId, user.id, ["id"])
      if (!participant) return throwForbidden(c, "You are not a participant in this conversation")
      await crudChatParticipant(db).setStatus(conversationId, user.id, "accepted")
      await crudChatParticipant(db).setHidden(conversationId, user.id, null)
      return c.json({})
    },
  )
  .post(
    "/:conversationId/ignore",
    describeRoute({
      description: "Ignore a chat request",
      responses: {
        200: {
          description: "Ignored",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not a participant",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", chatConversationIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { conversationId } = c.req.valid("param")
      const participant = await fetchChatParticipant(db).getOne(conversationId, user.id, ["id"])
      if (!participant) return throwForbidden(c, "You are not a participant in this conversation")
      await crudChatParticipant(db).setStatus(conversationId, user.id, "ignored")
      await crudChatParticipant(db).setHidden(conversationId, user.id, new Date())
      return c.json({})
    },
  )
  .post(
    "/:conversationId/leave",
    describeRoute({
      description: "Leave a conversation",
      responses: {
        200: {
          description: "Left",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not a participant",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", chatConversationIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { conversationId } = c.req.valid("param")
      const participant = await fetchChatParticipant(db).getOne(conversationId, user.id, ["id"])
      if (!participant) return throwForbidden(c, "You are not a participant in this conversation")
      await crudChatParticipant(db).remove(conversationId, user.id)
      return c.json({})
    },
  )
  .post(
    "/:conversationId/hide",
    describeRoute({
      description: "Hide a conversation until the next message",
      responses: {
        200: {
          description: "Hidden",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not a participant",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", chatConversationIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { conversationId } = c.req.valid("param")
      const participant = await fetchChatParticipant(db).getOne(conversationId, user.id, ["id"])
      if (!participant) return throwForbidden(c, "You are not a participant in this conversation")
      await crudChatParticipant(db).setHidden(conversationId, user.id, new Date())
      return c.json({})
    },
  )
  .patch(
    "/:conversationId",
    describeRoute({
      description: "Rename a group conversation (host only)",
      responses: {
        200: {
          description: "Renamed",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not the host",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Conversation not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", chatConversationIdSchemaParam),
    validator("json", chatRenameSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { conversationId } = c.req.valid("param")
      const { name } = c.req.valid("json")
      const conversation = await fetchChatConversation(db).getOne(conversationId, ["isGroup"])
      if (!conversation) return throwNotFound(c, "Conversation not found")
      if (!conversation.isGroup) return throwBadRequest(c, "Only group chats can be renamed")
      const participant = await fetchChatParticipant(db).getOne(conversationId, user.id, ["role"])
      if (!participant || participant.role !== "host") {
        return throwForbidden(c, "Only the host can rename this conversation")
      }
      await crudChatConversation(db).update(conversationId, { name })
      return c.json({})
    },
  )
  .delete(
    "/:conversationId/participants/:userId",
    describeRoute({
      description: "Remove a participant from a group conversation (host only)",
      responses: {
        200: {
          description: "Removed",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not the host",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", chatParticipantSchemaParam),
    async (c) => {
      const user = c.var.user
      const { conversationId, userId } = c.req.valid("param")
      if (userId === user.id) return throwBadRequest(c, "Use leave to remove yourself")
      const host = await fetchChatParticipant(db).getOne(conversationId, user.id, ["role"])
      if (!host || host.role !== "host") {
        return throwForbidden(c, "Only the host can remove participants")
      }
      await crudChatParticipant(db).remove(conversationId, userId)
      return c.json({})
    },
  )
  .delete(
    "/message/:messageId",
    describeRoute({
      description: "Delete one of your own messages",
      responses: {
        200: {
          description: "Deleted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not your message",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Message not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", chatMessageIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { messageId } = c.req.valid("param")
      const message = await fetchChatMessage(db).getOne(messageId, ["senderUserId"])
      if (!message) return throwNotFound(c, "Message not found")
      if (message.senderUserId !== user.id) return throwForbidden(c, "Not your message")
      await crudChatMessage(db).softDelete(messageId, new Date())
      return c.json({})
    },
  )

export default app
