import { crudUser, fetchAdmin, fetchUser } from "@lib/dao"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { EmptyObject, ErrorSchemaResponse, IdParamT } from "../utils/common.serializer"
import { throwNotFound } from "../utils/http-exception"
import { adminAuthMiddleware } from "./middleware"
import {
  adminSuspendSchemaRequest,
  adminUserSchemaQuery,
  adminUserSchemaResponse,
} from "./user.serializer"

const PAGE_SIZE = 25

interface AdminUserListItem {
  id: string
  username: string
  email: string
  postKarma: number
  commentKarma: number
  createdAt: string
  suspendedAt: string | null
  suspensionReason: string | null
}

interface AdminUserListPayload {
  data: AdminUserListItem[]
  nextCursor: string | null
}

const app = new Hono()
  .use(adminAuthMiddleware)
  .get(
    "/",
    describeRoute({
      description: "Search users by username or email",
      responses: {
        200: {
          description: "Matching users",
          content: { "application/json": { schema: resolver(adminUserSchemaResponse) } },
        },
      },
    }),
    validator("query", adminUserSchemaQuery),
    async (c) => {
      const query = c.req.valid("query")
      const q = query.q ?? null
      const cursor = query.cursor ?? null
      const rows = await fetchAdmin(db).searchUsers(q, cursor, PAGE_SIZE)
      const payload: AdminUserListPayload = {
        data: rows.map((r) => ({
          id: r.id,
          username: r.username,
          email: r.email,
          postKarma: r.postKarma,
          commentKarma: r.commentKarma,
          createdAt: r.createdAt.toISOString(),
          suspendedAt: r.suspendedAt ? r.suspendedAt.toISOString() : null,
          suspensionReason: r.suspensionReason,
        })),
        nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].id : null,
      }
      return c.json(payload)
    },
  )
  .post(
    "/:id/suspend",
    describeRoute({
      description: "Suspend a user site-wide",
      responses: {
        200: {
          description: "User suspended",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    validator("json", adminSuspendSchemaRequest),
    async (c) => {
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")
      const target = await fetchUser(db).getOne(id, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      await crudUser(db).suspend(id, body.reason ?? null)
      return c.json({})
    },
  )
  .post(
    "/:id/unsuspend",
    describeRoute({
      description: "Lift a user's suspension",
      responses: {
        200: {
          description: "User unsuspended",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const { id } = c.req.valid("param")
      const target = await fetchUser(db).getOne(id, ["id"])
      if (!target) return throwNotFound(c, "User not found")
      await crudUser(db).unsuspend(id)
      return c.json({})
    },
  )

export default app
