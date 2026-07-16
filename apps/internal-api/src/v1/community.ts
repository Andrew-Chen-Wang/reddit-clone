import { enqueueEsSyncCommunity } from "@utils/queues"
import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudCommunity } from "@lib/dao/community/crud"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchCommunityJoinRequest } from "@lib/dao/communityJoinRequest/fetch"
import { fetchCommunityMember } from "@lib/dao/communityMember/fetch"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { fetchCommunityRule } from "@lib/dao/communityRule/fetch"
import { fetchCommunityUserFlair } from "@lib/dao/communityUserFlair/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { ErrorSchemaResponse, IdParamT } from "../utils/common.serializer"
import { ErrorCode } from "../utils/errors.enum"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  communityCreateSchemaRequest,
  communityCreateSchemaResponse,
  communityDetailSchemaResponse,
  communityNameAvailableSchemaQuery,
  communityNameAvailableSchemaResponse,
  communityNameSchemaParam,
  communitySettingsSchemaResponse,
  communityUpdateSchemaRequest,
} from "./community.serializer"

function compileRegex(pattern: string): RegExp {
  return new RegExp(pattern)
}

const app = new Hono()
  .get(
    "/name-available",
    authNoThrowMiddleware,
    describeRoute({
      description: "Check whether a community name is available",
      responses: {
        200: {
          description: "Availability result",
          content: {
            "application/json": {
              schema: resolver(communityNameAvailableSchemaResponse),
            },
          },
        },
        400: {
          description: "Invalid community name",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("query", communityNameAvailableSchemaQuery),
    async (c) => {
      const { name } = c.req.valid("query")
      const taken = await fetchCommunity(db).isNameTaken(name)
      return c.json({ available: !taken })
    },
  )
  .get(
    "/:name",
    authNoThrowMiddleware,
    describeRoute({
      description: "Public community detail by name",
      responses: {
        200: {
          description: "Community detail",
          content: {
            "application/json": {
              schema: resolver(communityDetailSchemaResponse),
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
    validator("param", communityNameSchemaParam),
    async (c) => {
      const user = c.var.user
      const { name } = c.req.valid("param")

      const community = await fetchCommunity(db).getOneByName(name, [
        "id",
        "name",
        "displayName",
        "description",
        "visibility",
        "isNsfw",
        "topicId",
        "iconImageKey",
        "bannerImageKey",
        "memberCount",
        "defaultCommentSort",
        "welcomeMessage",
        "createdAt",
      ])

      if (!community) return throwNotFound(c, "Community not found")

      const view = await getCommunityAuthz(db).canView(
        { id: community.id, visibility: community.visibility },
        user?.id ?? null,
      )
      if (!view.ok) return throwNotFound(c, "Community not found")

      const rules = await fetchCommunityRule(db).getManyForCommunity(community.id, [
        "id",
        "name",
        "description",
        "position",
      ])

      const moderators = await fetchCommunityModerator(db).getManyForCommunity(community.id)

      let isMember = false
      let isFavorite = false
      let isModerator = false
      let notificationLevel: string | null = null
      let pendingJoinRequest = false
      let userFlair: Awaited<
        ReturnType<ReturnType<typeof fetchCommunityUserFlair>["getResolvedForUser"]>
      > = null

      if (user) {
        const membership = await fetchCommunityMember(db).getOne(community.id, user.id, [
          "isFavorite",
          "notificationLevel",
        ])
        if (membership) {
          isMember = true
          isFavorite = membership.isFavorite
          notificationLevel = membership.notificationLevel
        }
        isModerator = moderators.some((m) => m.userId === user.id)
        if (!isMember) {
          const request = await fetchCommunityJoinRequest(db).getOneForUser(community.id, user.id, [
            "id",
          ])
          pendingJoinRequest = request !== undefined
        }
        userFlair = await fetchCommunityUserFlair(db).getResolvedForUser(community.id, user.id)
      }

      return c.json({
        id: community.id,
        name: community.name,
        displayName: community.displayName,
        description: community.description,
        visibility: community.visibility,
        isNsfw: community.isNsfw,
        topicId: community.topicId,
        iconImageKey: community.iconImageKey,
        bannerImageKey: community.bannerImageKey,
        memberCount: community.memberCount,
        defaultCommentSort: community.defaultCommentSort,
        welcomeMessage: community.welcomeMessage,
        createdAt: community.createdAt.toISOString(),
        rules: rules.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          position: r.position,
        })),
        moderators: moderators.map((m) => ({
          userId: m.userId,
          username: m.username,
          avatarImageKey: m.avatarImageKey,
          position: m.position,
        })),
        viewer: {
          isMember,
          isFavorite,
          isModerator,
          notificationLevel,
          pendingJoinRequest,
          userFlair,
        },
      })
    },
  )
  .use(authMiddleware)
  .get(
    "/:id/settings",
    describeRoute({
      description: "Get all community settings for prefill (moderators with config permission)",
      responses: {
        200: {
          description: "Community settings",
          content: {
            "application/json": {
              schema: resolver(communitySettingsSchemaResponse),
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
          description: "Community not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const moderate = await getCommunityAuthz(db).canModerate(id, user.id, "config")
      if (!moderate.ok) return throwForbidden(c, "You cannot view these settings")

      const community = await fetchCommunity(db).getOne(id, [
        "id",
        "name",
        "displayName",
        "description",
        "defaultCommentSort",
        "topicId",
        "isNsfw",
        "welcomeMessage",
        "postGuidelines",
        "allowedPostTypes",
        "bodyPolicy",
        "titleRegex",
        "linkDomainWhitelist",
        "linkDomainBlacklist",
        "mediaInComments",
        "requirePostFlair",
        "holdForReview",
        "spoilerEnabled",
        "archiveOldPosts",
        "appearInFeeds",
        "appearInRecommendations",
        "notifyActivity",
        "notifyReports",
        "notifyMilestones",
      ])
      if (!community) return throwNotFound(c, "Community not found")

      return c.json(community)
    },
  )
  .post(
    "/",
    describeRoute({
      description: "Create a community",
      responses: {
        201: {
          description: "Community created",
          content: {
            "application/json": {
              schema: resolver(communityCreateSchemaResponse),
            },
          },
        },
        400: {
          description: "Invalid request or name already taken",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("json", communityCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      const taken = await fetchCommunity(db).isNameTaken(body.name)
      if (taken) {
        return throwBadRequest(c, "Community name already taken", ErrorCode.ResourceAlreadyExists, {
          target: "name",
        })
      }

      const community = await crudCommunity(db).create({
        name: body.name,
        displayName: body.displayName ?? null,
        description: body.description,
        visibility: body.visibility ?? "public",
        isNsfw: body.isNsfw ?? false,
        topicId: body.topicId ?? null,
        createdByUserId: user.id,
      })

      await enqueueEsSyncCommunity(community.id)

      return c.json({ id: community.id, name: community.name }, 201)
    },
  )
  .patch(
    "/:id",
    describeRoute({
      description: "Update community settings (moderators with config permission)",
      responses: {
        200: {
          description: "Community updated",
          content: {
            "application/json": {
              schema: resolver(communityCreateSchemaResponse),
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
          description: "Community not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", IdParamT),
    validator("json", communityUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const moderate = await getCommunityAuthz(db).canModerate(id, user.id, "config")
      if (!moderate.ok) return throwForbidden(c, "You cannot edit this community")

      if (body.titleRegex) {
        try {
          compileRegex(body.titleRegex)
        } catch {
          return throwBadRequest(c, "Invalid title regex", ErrorCode.ValidationFailed, {
            target: "titleRegex",
          })
        }
      }

      const updated = await crudCommunity(db).update(id, body)
      if (!updated) return throwNotFound(c, "Community not found")
      await enqueueEsSyncCommunity(updated.id)

      return c.json({ id: updated.id, name: updated.name })
    },
  )

export default app
