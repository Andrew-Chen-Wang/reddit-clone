import { crudUser } from "@lib/dao/user/crud"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwInternalServerError, throwNotFound } from "../utils/http-exception"
import {
  userByUsernameSchemaParam,
  userMeSchemaResponse,
  userPublicSchemaResponse,
  userUpdateSchemaRequest,
  usernameAvailableSchemaQuery,
  usernameAvailableSchemaResponse,
} from "./user.serializer"

const app = new Hono()
  .get(
    "/by-username/:username",
    authNoThrowMiddleware,
    describeRoute({
      description: "Public profile for a username",
      responses: {
        200: {
          description: "Public user profile",
          content: {
            "application/json": {
              schema: resolver(userPublicSchemaResponse),
            },
          },
        },
        404: {
          description: "User not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("param", userByUsernameSchemaParam),
    async (c) => {
      const { username } = c.req.valid("param")

      const profile = await fetchUser(db).getOneByUsername(username, [
        "id",
        "username",
        "displayName",
        "about",
        "avatarImageKey",
        "bannerImageKey",
        "postKarma",
        "commentKarma",
        "createdAt",
      ])

      if (!profile) return throwNotFound(c, "User not found")

      return c.json({
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        about: profile.about,
        avatarImageKey: profile.avatarImageKey,
        bannerImageKey: profile.bannerImageKey,
        postKarma: profile.postKarma,
        commentKarma: profile.commentKarma,
        createdAt: profile.createdAt.toISOString(),
      })
    },
  )
  .use(authMiddleware)
  .get(
    "/me",
    describeRoute({
      description: "Current authenticated user's profile",
      responses: {
        200: {
          description: "Current user profile",
          content: {
            "application/json": {
              schema: resolver(userMeSchemaResponse),
            },
          },
        },
        404: {
          description: "User not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    async (c) => {
      const user = c.var.user

      const profile = await fetchUser(db).getOne(user.id, [
        "id",
        "username",
        "displayName",
        "about",
        "avatarImageKey",
        "bannerImageKey",
        "postKarma",
        "commentKarma",
        "createdAt",
        "email",
        "isAdmin",
      ])

      if (!profile) return throwNotFound(c, "User not found")

      return c.json({
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        about: profile.about,
        avatarImageKey: profile.avatarImageKey,
        bannerImageKey: profile.bannerImageKey,
        postKarma: profile.postKarma,
        commentKarma: profile.commentKarma,
        createdAt: profile.createdAt.toISOString(),
        email: profile.email,
        isAdmin: profile.isAdmin,
      })
    },
  )
  .patch(
    "/me",
    describeRoute({
      description: "Update the current user's profile",
      responses: {
        200: {
          description: "Updated user profile",
          content: {
            "application/json": {
              schema: resolver(userMeSchemaResponse),
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
          description: "User not found",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("json", userUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      const profile = await crudUser(db).updateUser(user.id, body)

      if (!profile) return throwNotFound(c, "User not found")

      return c.json({
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        about: profile.about,
        avatarImageKey: profile.avatarImageKey,
        bannerImageKey: profile.bannerImageKey,
        postKarma: profile.postKarma,
        commentKarma: profile.commentKarma,
        createdAt: profile.createdAt.toISOString(),
        email: profile.email,
        isAdmin: profile.isAdmin,
      })
    },
  )
  .get(
    "/username-available",
    describeRoute({
      description: "Check whether a username is available",
      responses: {
        200: {
          description: "Availability result",
          content: {
            "application/json": {
              schema: resolver(usernameAvailableSchemaResponse),
            },
          },
        },
        400: {
          description: "Invalid username format",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("query", usernameAvailableSchemaQuery),
    async (c) => {
      const { username } = c.req.valid("query")

      const taken = await fetchUser(db).isUsernameTaken(username)

      return c.json({ available: !taken })
    },
  )
  .delete(
    "/me/delete",
    describeRoute({
      responses: {
        200: {
          description: "User successfully deleted",
          content: {
            "application/json": {
              schema: resolver(EmptyObject),
            },
          },
        },
        500: {
          description: "",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    async (c) => {
      const user = c.var.user

      const result = await crudUser(db).deleteUser(user.id)
      if (!result) {
        return throwInternalServerError(c, "Failed to delete user")
      }

      return c.json({}, 200)
    },
  )

export default app
