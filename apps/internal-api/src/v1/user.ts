import { enqueueEsSyncUser } from "@utils/queues"
import { fetchComment } from "@lib/dao/comment/fetch"
import { type RawPostRow, fetchPost } from "@lib/dao/post/fetch"
import { processPosts } from "@lib/dao/post/processPost"
import { crudUser } from "@lib/dao/user/crud"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { cursorOffsetPaginate } from "../utils/pagination"
import { throwInternalServerError, throwNotFound } from "../utils/http-exception"
import { buildCommentsWithPost } from "./comment-with-post"
import { feedSchemaResponse } from "./feed.serializer"
import {
  userByUsernameSchemaParam,
  userMeSchemaResponse,
  userPublicSchemaResponse,
  userUpdateSchemaRequest,
  usernameAvailableSchemaQuery,
  usernameAvailableSchemaResponse,
} from "./user.serializer"
import {
  commentTabSchemaResponse,
  postTabSchemaQuery,
  savedTabSchemaQuery,
  savedTabSchemaResponse,
} from "./user-tabs.serializer"

const TAB_PAGE_SIZE = 25

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
  .get(
    "/by-username/:username/comments",
    authNoThrowMiddleware,
    describeRoute({
      description: "A user's comments with post context, newest first",
      responses: {
        200: {
          description: "User comments",
          content: { "application/json": { schema: resolver(commentTabSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", userByUsernameSchemaParam),
    validator("query", postTabSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { username } = c.req.valid("param")
      const cursor = c.req.valid("query").cursor ?? null

      const profile = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!profile) return throwNotFound(c, "User not found")

      const { results, nextCursor } = await cursorOffsetPaginate({
        query: fetchComment(db).authorCommentsQuery(profile.id),
        cursor,
        ordering: "id",
        positionColumn: "comment.id",
        pageSize: TAB_PAGE_SIZE,
      })

      const data = await buildCommentsWithPost(results, user?.id ?? null)
      return c.json({ data, nextCursor })
    },
  )
  .use(authMiddleware)
  .get(
    "/me/saved",
    describeRoute({
      description: "The current user's saved posts or comments",
      responses: {
        200: {
          description: "Saved items",
          content: { "application/json": { schema: resolver(savedTabSchemaResponse) } },
        },
      },
    }),
    validator("query", savedTabSchemaQuery),
    async (c) => {
      const user = c.var.user
      const query = c.req.valid("query")
      const type = query.type ?? "posts"
      const cursor = query.cursor ?? null

      if (type === "comments") {
        const { results, nextCursor } = await cursorOffsetPaginate({
          query: fetchComment(db).savedCommentsQuery(user.id),
          cursor,
          ordering: "id",
          positionColumn: "comment.id",
          pageSize: TAB_PAGE_SIZE,
        })
        const comments = await buildCommentsWithPost(results, user.id)
        return c.json({ posts: [], comments, nextCursor })
      }

      const { results, nextCursor } = await cursorOffsetPaginate({
        query: fetchPost(db).savedPostsFeed(user.id),
        cursor,
        ordering: "id",
        positionColumn: "post.id",
        pageSize: TAB_PAGE_SIZE,
      })
      const posts = await processPosts(db, results, user.id)
      return c.json({ posts, comments: [], nextCursor })
    },
  )
  .get(
    "/me/hidden",
    describeRoute({
      description: "The current user's hidden posts",
      responses: {
        200: {
          description: "Hidden posts",
          content: { "application/json": { schema: resolver(feedSchemaResponse) } },
        },
      },
    }),
    validator("query", postTabSchemaQuery),
    async (c) => {
      const user = c.var.user
      const cursor = c.req.valid("query").cursor ?? null
      const { results, nextCursor } = await cursorOffsetPaginate({
        query: fetchPost(db).hiddenPostsFeed(user.id),
        cursor,
        ordering: "id",
        positionColumn: "post.id",
        pageSize: TAB_PAGE_SIZE,
      })
      const data = await processPosts(db, results, user.id)
      return c.json({ data, nextCursor })
    },
  )
  .get(
    "/me/upvoted",
    describeRoute({
      description: "Posts the current user has upvoted",
      responses: {
        200: {
          description: "Upvoted posts",
          content: { "application/json": { schema: resolver(feedSchemaResponse) } },
        },
      },
    }),
    validator("query", postTabSchemaQuery),
    async (c) => {
      const user = c.var.user
      const cursor = c.req.valid("query").cursor ?? null
      const { results, nextCursor } = await cursorOffsetPaginate({
        query: fetchPost(db).votedPostsFeed(user.id, 1),
        cursor,
        ordering: "id",
        positionColumn: "post.id",
        pageSize: TAB_PAGE_SIZE,
      })
      const data = await processPosts(db, results, user.id)
      return c.json({ data, nextCursor })
    },
  )
  .get(
    "/me/downvoted",
    describeRoute({
      description: "Posts the current user has downvoted",
      responses: {
        200: {
          description: "Downvoted posts",
          content: { "application/json": { schema: resolver(feedSchemaResponse) } },
        },
      },
    }),
    validator("query", postTabSchemaQuery),
    async (c) => {
      const user = c.var.user
      const cursor = c.req.valid("query").cursor ?? null
      const { results, nextCursor } = await cursorOffsetPaginate({
        query: fetchPost(db).votedPostsFeed(user.id, -1),
        cursor,
        ordering: "id",
        positionColumn: "post.id",
        pageSize: TAB_PAGE_SIZE,
      })
      const data = await processPosts(db, results, user.id)
      return c.json({ data, nextCursor })
    },
  )
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
      await enqueueEsSyncUser(user.id)

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
