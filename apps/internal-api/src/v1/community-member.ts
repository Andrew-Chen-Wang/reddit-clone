import { enqueueEsSyncCommunity } from "@utils/queues"
import { crudCommunityJoinRequest } from "@lib/dao/communityJoinRequest/crud"
import { crudCommunityMember } from "@lib/dao/communityMember/crud"
import { fetchCommunityMember } from "@lib/dao/communityMember/fetch"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { emitWelcome } from "@lib/dao/notification/emit-helpers"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwNotFound } from "../utils/http-exception"
import {
  communityIdSchemaParam,
  communityJoinSchemaResponse,
  membershipUpdateSchemaRequest,
  moderatedCommunitiesSchemaResponse,
  myCommunitiesSchemaResponse,
} from "./community-member.serializer"

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/mine",
    describeRoute({
      description: "Communities the current user has joined, favorites first",
      responses: {
        200: {
          description: "Joined communities",
          content: {
            "application/json": {
              schema: resolver(myCommunitiesSchemaResponse),
            },
          },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const communities = await fetchCommunityMember(db).getManyForUser(user.id)
      return c.json({
        data: communities.map((community) => ({
          id: community.id,
          name: community.name,
          displayName: community.displayName,
          iconImageKey: community.iconImageKey,
          isFavorite: community.isFavorite,
          notificationLevel: community.notificationLevel,
        })),
      })
    },
  )
  .get(
    "/moderated",
    describeRoute({
      description: "Communities the current user moderates",
      responses: {
        200: {
          description: "Moderated communities",
          content: {
            "application/json": {
              schema: resolver(moderatedCommunitiesSchemaResponse),
            },
          },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const communities = await fetchCommunityModerator(db).getManyForUser(user.id)
      return c.json({
        data: communities.map((community) => ({
          id: community.id,
          name: community.name,
          displayName: community.displayName,
          iconImageKey: community.iconImageKey,
        })),
      })
    },
  )
  .post(
    "/:communityId/join",
    describeRoute({
      description: "Join a public community, or request to join a restricted/private one",
      responses: {
        200: {
          description: "Join or request result",
          content: {
            "application/json": {
              schema: resolver(communityJoinSchemaResponse),
            },
          },
        },
        404: {
          description: "Community not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", communityIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")

      const community = await fetchCommunity(db).getOne(communityId, [
        "id",
        "visibility",
        "name",
        "welcomeMessage",
      ])
      if (!community) return throwNotFound(c, "Community not found")

      const existing = await fetchCommunityMember(db).getOne(communityId, user.id, ["id"])
      if (existing) return c.json({ joined: true, requested: false })

      if (community.visibility === "public") {
        await crudCommunityMember(db).join(communityId, user.id)
        await enqueueEsSyncCommunity(communityId)
        if (community.welcomeMessage) {
          await emitWelcome(db, {
            userId: user.id,
            communityId,
            communityName: community.name,
            welcomeMessage: community.welcomeMessage,
          })
        }
        return c.json({ joined: true, requested: false })
      }

      await crudCommunityJoinRequest(db).create(communityId, user.id, null)
      return c.json({ joined: false, requested: true })
    },
  )
  .post(
    "/:communityId/leave",
    describeRoute({
      description: "Leave a community",
      responses: {
        200: {
          description: "Left the community",
          content: {
            "application/json": {
              schema: resolver(EmptyObject),
            },
          },
        },
      },
    }),
    validator("param", communityIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      await crudCommunityMember(db).leave(communityId, user.id)
      await enqueueEsSyncCommunity(communityId)
      return c.json({})
    },
  )
  .patch(
    "/:communityId/membership",
    describeRoute({
      description: "Update the current user's membership preferences",
      responses: {
        200: {
          description: "Membership updated",
          content: {
            "application/json": {
              schema: resolver(EmptyObject),
            },
          },
        },
        400: {
          description: "Invalid request",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
        404: {
          description: "Membership not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", communityIdSchemaParam),
    validator("json", membershipUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      const body = c.req.valid("json")

      if (body.isFavorite === undefined && body.notificationLevel === undefined) {
        return throwBadRequest(c, "No membership fields to update")
      }

      const membership = await fetchCommunityMember(db).getOne(communityId, user.id, ["id"])
      if (!membership) return throwNotFound(c, "You are not a member of this community")

      if (body.isFavorite !== undefined) {
        await crudCommunityMember(db).setFavorite(communityId, user.id, body.isFavorite)
      }
      if (body.notificationLevel !== undefined) {
        await crudCommunityMember(db).setNotificationLevel(
          communityId,
          user.id,
          body.notificationLevel,
        )
      }

      return c.json({})
    },
  )

export default app
