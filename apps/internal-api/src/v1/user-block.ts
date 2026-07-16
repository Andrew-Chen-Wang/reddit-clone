import { fetchUser } from "@lib/dao/user/fetch"
import { crudUserBlock } from "@lib/dao/userBlock/crud"
import { fetchUserBlock } from "@lib/dao/userBlock/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwNotFound } from "../utils/http-exception"
import {
  blockListSchemaResponse,
  blockStateSchemaResponse,
  usernameSchemaParam,
} from "./user-block.serializer"

const BLOCK_CAP = 1000

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/mine",
    describeRoute({
      description: "Users the current user has blocked",
      responses: {
        200: {
          description: "Blocked users",
          content: { "application/json": { schema: resolver(blockListSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const rows = await fetchUserBlock(db).listMine(user.id)
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
      description: "Block a user",
      responses: {
        200: {
          description: "User blocked",
          content: { "application/json": { schema: resolver(blockStateSchemaResponse) } },
        },
        400: {
          description: "Invalid request or block limit reached",
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
      if (target.id === user.id) return throwBadRequest(c, "You cannot block yourself")

      const already = await fetchUserBlock(db).isBlocked(user.id, target.id)
      if (!already) {
        const count = await fetchUserBlock(db).count(user.id)
        if (count >= BLOCK_CAP) {
          return throwBadRequest(c, `You cannot block more than ${BLOCK_CAP} users`)
        }
      }

      await crudUserBlock(db).block(user.id, target.id)
      return c.json({ blocked: true })
    },
  )
  .delete(
    "/:username",
    describeRoute({
      description: "Unblock a user",
      responses: {
        200: {
          description: "User unblocked",
          content: { "application/json": { schema: resolver(blockStateSchemaResponse) } },
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

      await crudUserBlock(db).unblock(user.id, target.id)
      return c.json({ blocked: false })
    },
  )

export default app
