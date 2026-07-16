import { fetchCommunity } from "@lib/dao/community/fetch"
import { crudUserMutedCommunity } from "@lib/dao/userMutedCommunity/crud"
import { fetchUserMutedCommunity } from "@lib/dao/userMutedCommunity/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwNotFound } from "../utils/http-exception"
import {
  mutedCommunitySchemaParam,
  mutedListSchemaResponse,
  muteStateSchemaResponse,
} from "./muted-community.serializer"

const MUTE_CAP = 1000

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/mine",
    describeRoute({
      description: "Communities the current user has muted",
      responses: {
        200: {
          description: "Muted communities",
          content: { "application/json": { schema: resolver(mutedListSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const rows = await fetchUserMutedCommunity(db).listMine(user.id)
      return c.json({
        data: rows.map((r) => ({
          id: r.id,
          name: r.name,
          displayName: r.displayName,
          iconImageKey: r.iconImageKey,
          createdAt: r.createdAt.toISOString(),
        })),
      })
    },
  )
  .put(
    "/:communityId",
    describeRoute({
      description: "Mute a community",
      responses: {
        200: {
          description: "Community muted",
          content: { "application/json": { schema: resolver(muteStateSchemaResponse) } },
        },
        400: {
          description: "Invalid request or mute limit reached",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Community not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", mutedCommunitySchemaParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")

      const community = await fetchCommunity(db).getOne(communityId, ["id"])
      if (!community) return throwNotFound(c, "Community not found")

      const already = await fetchUserMutedCommunity(db).isMuted(user.id, communityId)
      if (!already) {
        const count = await fetchUserMutedCommunity(db).count(user.id)
        if (count >= MUTE_CAP) {
          return throwBadRequest(c, `You cannot mute more than ${MUTE_CAP} communities`)
        }
      }

      await crudUserMutedCommunity(db).mute(user.id, communityId)
      return c.json({ muted: true })
    },
  )
  .delete(
    "/:communityId",
    describeRoute({
      description: "Unmute a community",
      responses: {
        200: {
          description: "Community unmuted",
          content: { "application/json": { schema: resolver(muteStateSchemaResponse) } },
        },
      },
    }),
    validator("param", mutedCommunitySchemaParam),
    async (c) => {
      const user = c.var.user
      const { communityId } = c.req.valid("param")
      await crudUserMutedCommunity(db).unmute(user.id, communityId)
      return c.json({ muted: false })
    },
  )

export default app
