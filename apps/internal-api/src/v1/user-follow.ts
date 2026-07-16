import { emitNewFollower } from "@lib/dao/notification/emit-helpers"
import { fetchUser } from "@lib/dao/user/fetch"
import { crudUserFollow } from "@lib/dao/userFollow/crud"
import { fetchUserBlock } from "@lib/dao/userBlock/fetch"
import { fetchUserFollow } from "@lib/dao/userFollow/fetch"
import { fetchUserSettings } from "@lib/dao/userSettings/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  followListSchemaResponse,
  followStateSchemaResponse,
  usernameSchemaParam,
} from "./user-follow.serializer"

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/mine",
    describeRoute({
      description: "Users the current user follows",
      responses: {
        200: {
          description: "Followed users",
          content: { "application/json": { schema: resolver(followListSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const rows = await fetchUserFollow(db).listMine(user.id)
      return c.json({
        data: rows.map((r) => ({
          id: r.id,
          username: r.username,
          displayName: r.displayName,
          avatarImageKey: r.avatarImageKey,
          createdAt: r.createdAt.toISOString(),
        })),
      })
    },
  )
  .put(
    "/:username",
    describeRoute({
      description: "Follow a user's profile",
      responses: {
        200: {
          description: "User followed",
          content: { "application/json": { schema: resolver(followStateSchemaResponse) } },
        },
        400: {
          description: "Invalid request",
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
    validator("param", usernameSchemaParam),
    async (c) => {
      const user = c.var.user
      const { username } = c.req.valid("param")

      const target = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      if (target.id === user.id) return throwBadRequest(c, "You cannot follow yourself")

      const blocked = await fetchUserBlock(db).isBlockedEither(user.id, target.id)
      if (blocked) return throwForbidden(c, "You cannot follow this user")

      const settings = await fetchUserSettings(db).getOne(target.id, ["allowFollows"])
      if (settings && !settings.allowFollows) {
        return throwForbidden(c, "This user does not allow followers")
      }

      await crudUserFollow(db).follow(user.id, target.id)
      await emitNewFollower(db, { followedUserId: target.id, actorUserId: user.id })
      return c.json({ following: true })
    },
  )
  .delete(
    "/:username",
    describeRoute({
      description: "Unfollow a user's profile",
      responses: {
        200: {
          description: "User unfollowed",
          content: { "application/json": { schema: resolver(followStateSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", usernameSchemaParam),
    async (c) => {
      const user = c.var.user
      const { username } = c.req.valid("param")

      const target = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!target) return throwNotFound(c, "User not found")

      await crudUserFollow(db).unfollow(user.id, target.id)
      return c.json({ following: false })
    },
  )

export default app
