import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudCommunityModerator } from "@lib/dao/communityModerator/crud"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { crudCommunityModeratorInvite } from "@lib/dao/communityModeratorInvite/crud"
import { fetchCommunityModeratorInvite } from "@lib/dao/communityModeratorInvite/fetch"
import { crudModAction } from "@lib/dao/modAction/crud"
import { emitModInvite } from "@lib/dao/notification/emit-helpers"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  modTeamCommunityParam,
  modTeamInviteCreatedSchemaResponse,
  modTeamInviteIdParam,
  modTeamInviteSchemaRequest,
  modTeamListSchemaResponse,
  modTeamModParam,
  modTeamMyInvitesSchemaResponse,
  modTeamUpdatePermsSchemaRequest,
} from "./mod-team.serializer"

async function isFullMod(communityId: string, userId: string): Promise<boolean> {
  const mod = await fetchCommunityModerator(db).getOne(communityId, userId, ["permEverything"])
  return mod?.permEverything === true
}

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/my-invites",
    describeRoute({
      description: "List the current user's pending moderator invites",
      responses: {
        200: {
          description: "Pending invites",
          content: { "application/json": { schema: resolver(modTeamMyInvitesSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const invites = await fetchCommunityModeratorInvite(db).getPendingForUser(user.id)
      return c.json({
        data: invites.map((i) => ({
          id: i.id,
          communityId: i.communityId,
          communityName: i.communityName,
          communityDisplayName: i.communityDisplayName,
          iconImageKey: i.iconImageKey,
          createdAt: i.createdAt.toISOString(),
        })),
      })
    },
  )
  .get(
    "/:communityId",
    describeRoute({
      description: "List the moderator team and pending invites (moderators)",
      responses: {
        200: {
          description: "Moderator team",
          content: { "application/json": { schema: resolver(modTeamListSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modTeamCommunityParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")

      const moderate = await getCommunityAuthz(db).canModerate(communityId, user.id)
      if (!moderate.ok) return throwForbidden(c, "You cannot view the moderator team")

      const moderators = await fetchCommunityModerator(db).getManyForCommunity(communityId)
      const invites = await fetchCommunityModeratorInvite(db).getPendingForCommunity(communityId)

      return c.json({
        moderators: moderators.map((m) => ({
          userId: m.userId,
          username: m.username,
          avatarImageKey: m.avatarImageKey,
          position: m.position,
          permEverything: m.permEverything,
          permUsers: m.permUsers,
          permConfig: m.permConfig,
          permFlair: m.permFlair,
          permMail: m.permMail,
          permPostsComments: m.permPostsComments,
          permWiki: m.permWiki,
        })),
        invites: invites.map((i) => ({
          id: i.id,
          userId: i.inviteeUserId,
          username: i.username,
          avatarImageKey: i.avatarImageKey,
          createdAt: i.createdAt.toISOString(),
        })),
      })
    },
  )
  .post(
    "/:communityId/invite",
    describeRoute({
      description: "Invite a user to the moderator team (full moderators only)",
      responses: {
        201: {
          description: "Invite created",
          content: {
            "application/json": { schema: resolver(modTeamInviteCreatedSchemaResponse) },
          },
        },
        400: {
          description: "User already a moderator or already invited",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
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
    validator("param", modTeamCommunityParam),
    validator("json", modTeamInviteSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      if (!(await isFullMod(communityId, user.id))) {
        return throwForbidden(c, "You cannot manage the moderator team")
      }

      const invitee = await fetchUser(db).getOneByUsername(body.username, ["id"])
      if (!invitee) return throwNotFound(c, "User not found")

      const existingMod = await fetchCommunityModerator(db).getOne(communityId, invitee.id, ["id"])
      if (existingMod) return throwBadRequest(c, "User is already a moderator")

      const pending = await fetchCommunityModeratorInvite(db).hasPending(communityId, invitee.id)
      if (pending) return throwBadRequest(c, "User already has a pending invite")

      const invite = await crudCommunityModeratorInvite(db).create({
        communityId,
        inviteeUserId: invitee.id,
        invitedByUserId: user.id,
        permEverything: body.permEverything ?? false,
        permUsers: body.permUsers ?? false,
        permConfig: body.permConfig ?? false,
        permFlair: body.permFlair ?? false,
        permMail: body.permMail ?? false,
        permPostsComments: body.permPostsComments ?? false,
        permWiki: body.permWiki ?? false,
      })
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: "invite_moderator",
        targetUserId: invitee.id,
      })
      await emitModInvite(db, {
        inviteeUserId: invitee.id,
        actorUserId: user.id,
        communityId,
      })
      return c.json({ id: invite.id }, 201)
    },
  )
  .post(
    "/invite/:id/accept",
    describeRoute({
      description: "Accept a moderator invite",
      responses: {
        200: {
          description: "Invite accepted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not your invite",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Invite not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modTeamInviteIdParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const invite = await fetchCommunityModeratorInvite(db).getOne(id, [
        "communityId",
        "inviteeUserId",
        "status",
        "permEverything",
        "permUsers",
        "permConfig",
        "permFlair",
        "permMail",
        "permPostsComments",
        "permWiki",
      ])
      if (!invite || invite.status !== "pending") return throwNotFound(c, "Invite not found")
      if (invite.inviteeUserId !== user.id) return throwForbidden(c, "This invite is not yours")

      const resolved = await crudCommunityModeratorInvite(db).resolve(id, "accepted")
      if (!resolved) return throwNotFound(c, "Invite not found")

      const existing = await fetchCommunityModerator(db).getManyForCommunity(invite.communityId)
      const nextPosition = existing.reduce((max, m) => Math.max(max, m.position), -1) + 1

      await crudCommunityModerator(db).add({
        communityId: invite.communityId,
        userId: user.id,
        position: nextPosition,
        permEverything: invite.permEverything,
        permUsers: invite.permUsers,
        permConfig: invite.permConfig,
        permFlair: invite.permFlair,
        permMail: invite.permMail,
        permPostsComments: invite.permPostsComments,
        permWiki: invite.permWiki,
      })
      await crudModAction(db).log({
        communityId: invite.communityId,
        modUserId: user.id,
        action: "accept_moderator_invite",
        targetUserId: user.id,
      })
      return c.json({})
    },
  )
  .post(
    "/invite/:id/decline",
    describeRoute({
      description: "Decline a moderator invite",
      responses: {
        200: {
          description: "Invite declined",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not your invite",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Invite not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modTeamInviteIdParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const invite = await fetchCommunityModeratorInvite(db).getOne(id, ["inviteeUserId", "status"])
      if (!invite || invite.status !== "pending") return throwNotFound(c, "Invite not found")
      if (invite.inviteeUserId !== user.id) return throwForbidden(c, "This invite is not yours")

      await crudCommunityModeratorInvite(db).resolve(id, "declined")
      return c.json({})
    },
  )
  .patch(
    "/:communityId/mod/:userId",
    describeRoute({
      description: "Update a moderator's permissions (full moderators only)",
      responses: {
        200: {
          description: "Permissions updated",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Moderator not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modTeamModParam),
    validator("json", modTeamUpdatePermsSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId, userId } = c.req.valid("param")
      const body = c.req.valid("json")

      if (!(await isFullMod(communityId, user.id))) {
        return throwForbidden(c, "You cannot manage the moderator team")
      }

      const target = await fetchCommunityModerator(db).getOne(communityId, userId, ["position"])
      if (!target) return throwNotFound(c, "Moderator not found")
      if (target.position === 0 && userId !== user.id) {
        return throwForbidden(c, "You cannot edit the top moderator")
      }

      await crudCommunityModerator(db).updatePerms(communityId, userId, body)
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: "update_moderator",
        targetUserId: userId,
      })
      return c.json({})
    },
  )
  .delete(
    "/:communityId/mod/:userId",
    describeRoute({
      description: "Remove a moderator (full moderators, or self)",
      responses: {
        200: {
          description: "Moderator removed",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Moderator not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", modTeamModParam),
    async (c) => {
      const user = c.var.user
      const { communityId, userId } = c.req.valid("param")

      const target = await fetchCommunityModerator(db).getOne(communityId, userId, ["position"])
      if (!target) return throwNotFound(c, "Moderator not found")

      const isSelf = userId === user.id
      if (!isSelf && !(await isFullMod(communityId, user.id))) {
        return throwForbidden(c, "You cannot manage the moderator team")
      }
      if (target.position === 0 && !isSelf) {
        return throwForbidden(c, "You cannot remove the top moderator")
      }

      await crudCommunityModerator(db).remove(communityId, userId)
      await crudModAction(db).log({
        communityId,
        modUserId: user.id,
        action: "remove_moderator",
        targetUserId: userId,
      })
      return c.json({})
    },
  )

export default app
