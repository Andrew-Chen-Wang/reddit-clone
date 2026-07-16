import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudCommunityApprovedUser } from "@lib/dao/communityApprovedUser/crud"
import { fetchCommunityApprovedUser } from "@lib/dao/communityApprovedUser/fetch"
import { crudCommunityBan } from "@lib/dao/communityBan/crud"
import { fetchCommunityBan } from "@lib/dao/communityBan/fetch"
import { crudCommunityMutedUser } from "@lib/dao/communityMutedUser/crud"
import { fetchCommunityMutedUser } from "@lib/dao/communityMutedUser/fetch"
import { crudModAction } from "@lib/dao/modAction/crud"
import { crudModNote } from "@lib/dao/modNote/crud"
import { fetchModNote } from "@lib/dao/modNote/fetch"
import { emitUserBanned } from "@lib/dao/notification/emit-helpers"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  approveSchemaRequest,
  approvedListSchemaResponse,
  banSchemaRequest,
  bannedListSchemaResponse,
  modUsersCommunityParam,
  modUsersNoteIdParam,
  modUsersUsernameParam,
  muteSchemaRequest,
  mutedListSchemaResponse,
  noteCreatedSchemaResponse,
  noteCreateSchemaRequest,
  notesListSchemaResponse,
  restrictedListSchemaResponse,
} from "./mod-users.serializer"

const DAY_MS = 24 * 60 * 60 * 1000

function expiryFromDays(days: number | null | undefined): Date | null {
  if (days === null || days === undefined) return null
  return new Date(Date.now() + days * DAY_MS)
}

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/:communityId/banned",
    describeRoute({
      description: "List banned users (moderators with users permission)",
      responses: {
        200: {
          description: "Banned users",
          content: { "application/json": { schema: resolver(bannedListSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersCommunityParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const rows = await fetchCommunityBan(db).listForCommunity(communityId)
      return c.json({
        data: rows.map((r) => ({
          userId: r.userId,
          username: r.username,
          avatarImageKey: r.avatarImageKey,
          communityRuleId: r.communityRuleId,
          modNote: r.modNote,
          messageToUser: r.messageToUser,
          expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
        })),
      })
    },
  )
  .get(
    "/:communityId/muted",
    describeRoute({
      description: "List muted users (moderators with users permission)",
      responses: {
        200: {
          description: "Muted users",
          content: { "application/json": { schema: resolver(mutedListSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersCommunityParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const rows = await fetchCommunityMutedUser(db).listForCommunity(communityId)
      return c.json({
        data: rows.map((r) => ({
          userId: r.userId,
          username: r.username,
          avatarImageKey: r.avatarImageKey,
          expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
        })),
      })
    },
  )
  .get(
    "/:communityId/approved",
    describeRoute({
      description: "List approved users (moderators with users permission)",
      responses: {
        200: {
          description: "Approved users",
          content: { "application/json": { schema: resolver(approvedListSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersCommunityParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const rows = await fetchCommunityApprovedUser(db).listForCommunity(communityId)
      return c.json({
        data: rows.map((r) => ({
          userId: r.userId,
          username: r.username,
          avatarImageKey: r.avatarImageKey,
          createdAt: r.createdAt.toISOString(),
        })),
      })
    },
  )
  .get(
    "/:communityId/restricted",
    describeRoute({
      description: "List banned and muted users (moderators with users permission)",
      responses: {
        200: {
          description: "Restricted users",
          content: { "application/json": { schema: resolver(restrictedListSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersCommunityParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const banned = await fetchCommunityBan(db).listForCommunity(communityId)
      const muted = await fetchCommunityMutedUser(db).listForCommunity(communityId)
      return c.json({
        banned: banned.map((r) => ({
          userId: r.userId,
          username: r.username,
          avatarImageKey: r.avatarImageKey,
          communityRuleId: r.communityRuleId,
          modNote: r.modNote,
          messageToUser: r.messageToUser,
          expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
        })),
        muted: muted.map((r) => ({
          userId: r.userId,
          username: r.username,
          avatarImageKey: r.avatarImageKey,
          expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
        })),
      })
    },
  )
  .get(
    "/:communityId/notes/:username",
    describeRoute({
      description: "List mod notes for a user (moderators with users permission)",
      responses: {
        200: {
          description: "Mod notes",
          content: { "application/json": { schema: resolver(notesListSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersUsernameParam),
    async (c) => {
      const user = c.var.user
      const { communityId, username } = c.req.valid("param")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const target = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      const notes = await fetchModNote(db).getManyForUser(communityId, target.id)
      return c.json({
        data: notes.map((n) => ({
          id: n.id,
          label: n.label,
          note: n.note,
          createdByUserId: n.createdByUserId,
          createdByUsername: n.createdByUsername,
          createdAt: n.createdAt.toISOString(),
        })),
      })
    },
  )
  .post(
    "/:communityId/ban",
    describeRoute({
      description: "Ban a user (moderators with users permission)",
      responses: {
        200: {
          description: "User banned",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersCommunityParam),
    validator("json", banSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const target = await fetchUser(db).getOneByUsername(body.username, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      await crudCommunityBan(db).ban({
        communityId,
        userId: target.id,
        communityRuleId: body.communityRuleId ?? null,
        modNote: body.modNote ?? null,
        messageToUser: body.messageToUser ?? null,
        expiresAt: expiryFromDays(body.days),
        bannedByUserId: user.id,
      })
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: "ban_user",
        targetUserId: target.id,
        details: { days: body.days ?? null },
      })
      await emitUserBanned(db, {
        userId: target.id,
        actorUserId: user.id,
        communityId,
        messageToUser: body.messageToUser ?? null,
      })
      return c.json({})
    },
  )
  .delete(
    "/:communityId/ban/:username",
    describeRoute({
      description: "Unban a user (moderators with users permission)",
      responses: {
        200: {
          description: "User unbanned",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersUsernameParam),
    async (c) => {
      const user = c.var.user
      const { communityId, username } = c.req.valid("param")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const target = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      await crudCommunityBan(db).unban(communityId, target.id)
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: "unban_user",
        targetUserId: target.id,
      })
      return c.json({})
    },
  )
  .post(
    "/:communityId/mute",
    describeRoute({
      description: "Mute a user (moderators with users permission)",
      responses: {
        200: {
          description: "User muted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersCommunityParam),
    validator("json", muteSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const target = await fetchUser(db).getOneByUsername(body.username, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      await crudCommunityMutedUser(db).mute({
        communityId,
        userId: target.id,
        expiresAt: expiryFromDays(body.days),
        mutedByUserId: user.id,
      })
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: "mute_user",
        targetUserId: target.id,
        details: { days: body.days ?? null },
      })
      return c.json({})
    },
  )
  .delete(
    "/:communityId/mute/:username",
    describeRoute({
      description: "Unmute a user (moderators with users permission)",
      responses: {
        200: {
          description: "User unmuted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersUsernameParam),
    async (c) => {
      const user = c.var.user
      const { communityId, username } = c.req.valid("param")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const target = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      await crudCommunityMutedUser(db).unmute(communityId, target.id)
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: "unmute_user",
        targetUserId: target.id,
      })
      return c.json({})
    },
  )
  .post(
    "/:communityId/approved",
    describeRoute({
      description: "Approve a user (moderators with users permission)",
      responses: {
        200: {
          description: "User approved",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersCommunityParam),
    validator("json", approveSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const target = await fetchUser(db).getOneByUsername(body.username, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      await crudCommunityApprovedUser(db).approve(communityId, target.id, user.id)
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: "approve_user",
        targetUserId: target.id,
      })
      return c.json({})
    },
  )
  .delete(
    "/:communityId/approved/:username",
    describeRoute({
      description: "Remove an approved user (moderators with users permission)",
      responses: {
        200: {
          description: "Approved user removed",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersUsernameParam),
    async (c) => {
      const user = c.var.user
      const { communityId, username } = c.req.valid("param")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const target = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      await crudCommunityApprovedUser(db).unapprove(communityId, target.id)
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: "unapprove_user",
        targetUserId: target.id,
      })
      return c.json({})
    },
  )
  .post(
    "/:communityId/notes/:username",
    describeRoute({
      description: "Create a mod note for a user (moderators with users permission)",
      responses: {
        201: {
          description: "Mod note created",
          content: { "application/json": { schema: resolver(noteCreatedSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersUsernameParam),
    validator("json", noteCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId, username } = c.req.valid("param")
      const body = c.req.valid("json")
      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      const target = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      const note = await crudModNote(db).create({
        communityId,
        targetUserId: target.id,
        label: body.label ?? null,
        note: body.note,
        createdByUserId: user.id,
      })
      return c.json({ id: note.id }, 201)
    },
  )
  .delete(
    "/notes/:id",
    describeRoute({
      description: "Delete a mod note (moderators with users permission)",
      responses: {
        200: {
          description: "Mod note deleted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Mod note not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modUsersNoteIdParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const note = await fetchModNote(db).getOne(id, ["communityId"])
      if (!note) return throwNotFound(c, "Mod note not found")
      const moderate = await getCommunityAuthz(db).canModerate(note.communityId, user.id, "users")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage users")
      await crudModNote(db).deleteOne(id)
      return c.json({})
    },
  )

export default app
