import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { fetchCommunityMutedUser } from "@lib/dao/communityMutedUser/fetch"
import { crudModmailConversation } from "@lib/dao/modmailConversation/crud"
import { fetchModmailConversation } from "@lib/dao/modmailConversation/fetch"
import { crudModmailMessage } from "@lib/dao/modmailMessage/crud"
import { fetchModmailMessage } from "@lib/dao/modmailMessage/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  modmailCommunityIdSchemaParam,
  modmailConversationSchemaResponse,
  modmailCreatedSchemaResponse,
  modmailCreateSchemaRequest,
  modmailFolderSchemaQuery,
  modmailIdSchemaParam,
  modmailMessagesSchemaResponse,
  modmailReplySchemaRequest,
} from "./modmail.serializer"

interface ModmailListRow {
  id: string
  subject: string
  folder: string
  isHighlighted: boolean
  communityId: string
  communityName: string
  communityIconImageKey: string | null
  participantUserId: string
  lastMessageAt: Date
  createdAt: Date
  participantUsername?: string
  participantAvatarImageKey?: string | null
}

const serializeConversation = (r: ModmailListRow) => ({
  id: r.id,
  subject: r.subject,
  folder: r.folder,
  isHighlighted: r.isHighlighted,
  communityId: r.communityId,
  communityName: r.communityName,
  communityIconImageKey: r.communityIconImageKey,
  participantUserId: r.participantUserId,
  participantUsername: r.participantUsername ?? null,
  participantAvatarImageKey: r.participantAvatarImageKey ?? null,
  lastMessageAt: r.lastMessageAt.toISOString(),
  createdAt: r.createdAt.toISOString(),
})

const app = new Hono()
  .use(authMiddleware)
  .post(
    "/",
    describeRoute({
      description: "Start a modmail conversation with a community's mods",
      responses: {
        201: {
          description: "Conversation created",
          content: { "application/json": { schema: resolver(modmailCreatedSchemaResponse) } },
        },
        403: {
          description: "Not allowed to message these mods",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Community not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", modmailCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityName, subject, body } = c.req.valid("json")

      const community = await fetchCommunity(db).getOneByName(communityName, ["id", "visibility"])
      if (!community) return throwNotFound(c, "Community not found")

      const viewable = await getCommunityAuthz(db).canView(community, user.id)
      if (!viewable.ok) return throwForbidden(c, "You cannot message this community")

      if (await fetchCommunityMutedUser(db).isMuted(community.id, user.id)) {
        return throwForbidden(c, "You are muted in this community")
      }

      const now = new Date()
      const conversation = await crudModmailConversation(db).create({
        communityId: community.id,
        subject,
        participantUserId: user.id,
        folder: "new",
        lastMessageAt: now,
      })
      await crudModmailMessage(db).create({
        conversationId: conversation.id,
        authorUserId: user.id,
        bodyMd: body,
        isInternalNote: false,
      })
      return c.json({ conversationId: conversation.id }, 201)
    },
  )
  .get(
    "/mine",
    describeRoute({
      description: "The current user's modmail conversations",
      responses: {
        200: {
          description: "Conversations",
          content: { "application/json": { schema: resolver(modmailConversationSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const rows = await fetchModmailConversation(db).listForParticipant(user.id)
      return c.json({ data: rows.map(serializeConversation) })
    },
  )
  .get(
    "/mine-as-mod",
    describeRoute({
      description: "Modmail across every community the user moderates with mail permission",
      responses: {
        200: {
          description: "Conversations",
          content: { "application/json": { schema: resolver(modmailConversationSchemaResponse) } },
        },
      },
    }),
    validator("query", modmailFolderSchemaQuery),
    async (c) => {
      const user = c.var.user
      const folder = c.req.valid("query").folder ?? null
      const modComms = await fetchCommunityModerator(db).getManyForUser(user.id)
      const mailCommunityIds: string[] = []
      for (const comm of modComms) {
        const authz = await getCommunityAuthz(db).canModerate(comm.id, user.id, "mail")
        if (authz.ok) mailCommunityIds.push(comm.id)
      }
      const rows = await fetchModmailConversation(db).listForCommunities(mailCommunityIds, folder)
      return c.json({ data: rows.map(serializeConversation) })
    },
  )
  .get(
    "/community/:communityId",
    describeRoute({
      description: "Modmail for a single community (mods with mail permission)",
      responses: {
        200: {
          description: "Conversations",
          content: { "application/json": { schema: resolver(modmailConversationSchemaResponse) } },
        },
        403: {
          description: "Not a mod with mail permission",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modmailCommunityIdSchemaParam),
    validator("query", modmailFolderSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const folder = c.req.valid("query").folder ?? null
      const authz = await getCommunityAuthz(db).canModerate(communityId, user.id, "mail")
      if (!authz.ok) return throwForbidden(c, "You cannot view this community's modmail")
      const rows = await fetchModmailConversation(db).listForCommunities([communityId], folder)
      return c.json({ data: rows.map(serializeConversation) })
    },
  )
  .get(
    "/:id/messages",
    describeRoute({
      description:
        "Messages in a modmail conversation (internal notes hidden from the participant)",
      responses: {
        200: {
          description: "Messages",
          content: { "application/json": { schema: resolver(modmailMessagesSchemaResponse) } },
        },
        403: {
          description: "Not allowed to view this conversation",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Conversation not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modmailIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const conversation = await fetchModmailConversation(db).getOne(id, [
        "communityId",
        "participantUserId",
        "subject",
        "folder",
        "isHighlighted",
      ])
      if (!conversation) return throwNotFound(c, "Conversation not found")

      const isMod = (
        await getCommunityAuthz(db).canModerate(conversation.communityId, user.id, "mail")
      ).ok
      const isParticipant = conversation.participantUserId === user.id
      if (!isMod && !isParticipant) return throwForbidden(c, "You cannot view this conversation")

      const rows = await fetchModmailMessage(db).listForConversation(id, isMod)
      return c.json({
        isMod,
        subject: conversation.subject,
        folder: conversation.folder,
        isHighlighted: conversation.isHighlighted,
        data: rows.map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          authorUserId: m.authorUserId,
          bodyMd: m.bodyMd,
          isInternalNote: m.isInternalNote,
          createdAt: m.createdAt.toISOString(),
          authorUsername: m.authorUsername,
          authorAvatarImageKey: m.authorAvatarImageKey,
        })),
      })
    },
  )
  .post(
    "/:id/messages",
    describeRoute({
      description: "Reply to a modmail conversation or add an internal note (notes are mods only)",
      responses: {
        201: {
          description: "Message created",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not allowed to reply",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Conversation not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modmailIdSchemaParam),
    validator("json", modmailReplySchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const { body, isInternalNote } = c.req.valid("json")
      const conversation = await fetchModmailConversation(db).getOne(id, [
        "communityId",
        "participantUserId",
        "folder",
      ])
      if (!conversation) return throwNotFound(c, "Conversation not found")

      const isMod = (
        await getCommunityAuthz(db).canModerate(conversation.communityId, user.id, "mail")
      ).ok
      const isParticipant = conversation.participantUserId === user.id
      if (!isMod && !isParticipant)
        return throwForbidden(c, "You cannot reply to this conversation")
      if (isInternalNote && !isMod) return throwForbidden(c, "Only mods can add internal notes")

      if (
        !isMod &&
        (await fetchCommunityMutedUser(db).isMuted(conversation.communityId, user.id))
      ) {
        return throwForbidden(c, "You are muted in this community")
      }

      const now = new Date()
      const note = Boolean(isInternalNote) && isMod
      await crudModmailMessage(db).create({
        conversationId: id,
        authorUserId: user.id,
        bodyMd: body,
        isInternalNote: note,
      })
      if (isMod && !note && conversation.folder === "new") {
        await crudModmailConversation(db).update(id, { folder: "in_progress", lastMessageAt: now })
      } else {
        await crudModmailConversation(db).update(id, { lastMessageAt: now })
      }
      return c.json({}, 201)
    },
  )
  .post(
    "/:id/archive",
    describeRoute({
      description: "Archive a modmail conversation (mods)",
      responses: {
        200: {
          description: "Archived",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not a mod with mail permission",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Conversation not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modmailIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const conversation = await fetchModmailConversation(db).getOne(id, ["communityId"])
      if (!conversation) return throwNotFound(c, "Conversation not found")
      const authz = await getCommunityAuthz(db).canModerate(
        conversation.communityId,
        user.id,
        "mail",
      )
      if (!authz.ok) return throwForbidden(c, "You cannot moderate this conversation")
      await crudModmailConversation(db).update(id, { folder: "archived" })
      return c.json({})
    },
  )
  .post(
    "/:id/unarchive",
    describeRoute({
      description: "Move an archived modmail conversation back to in progress (mods)",
      responses: {
        200: {
          description: "Unarchived",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not a mod with mail permission",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Conversation not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modmailIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const conversation = await fetchModmailConversation(db).getOne(id, ["communityId"])
      if (!conversation) return throwNotFound(c, "Conversation not found")
      const authz = await getCommunityAuthz(db).canModerate(
        conversation.communityId,
        user.id,
        "mail",
      )
      if (!authz.ok) return throwForbidden(c, "You cannot moderate this conversation")
      await crudModmailConversation(db).update(id, { folder: "in_progress" })
      return c.json({})
    },
  )
  .post(
    "/:id/highlight",
    describeRoute({
      description: "Toggle the highlight flag on a modmail conversation (mods)",
      responses: {
        200: {
          description: "Toggled",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not a mod with mail permission",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Conversation not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modmailIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const conversation = await fetchModmailConversation(db).getOne(id, [
        "communityId",
        "isHighlighted",
      ])
      if (!conversation) return throwNotFound(c, "Conversation not found")
      const authz = await getCommunityAuthz(db).canModerate(
        conversation.communityId,
        user.id,
        "mail",
      )
      if (!authz.ok) return throwForbidden(c, "You cannot moderate this conversation")
      await crudModmailConversation(db).update(id, { isHighlighted: !conversation.isHighlighted })
      return c.json({})
    },
  )

export default app
