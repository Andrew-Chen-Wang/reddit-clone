import { enqueueEsSyncUser } from "@utils/queues"
import { fetchComment } from "@lib/dao/comment/fetch"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { fetchPost } from "@lib/dao/post/fetch"
import { processPosts } from "@lib/dao/post/processPost"
import { crudUser } from "@lib/dao/user/crud"
import { fetchUser } from "@lib/dao/user/fetch"
import { crudUserSocialLink } from "@lib/dao/userSocialLink/crud"
import { fetchUserSocialLink } from "@lib/dao/userSocialLink/fetch"
import { fetchUserOverview } from "@lib/dao/userOverview/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse, IdParamT } from "../utils/common.serializer"
import { cursorOffsetPaginate } from "../utils/pagination"
import { throwBadRequest, throwInternalServerError, throwNotFound } from "../utils/http-exception"
import { buildCommentsWithPost } from "./comment-with-post"
import { feedSchemaResponse } from "./feed.serializer"
import {
  userByUsernameSchemaParam,
  userMeSchemaResponse,
  userModeratingSchemaResponse,
  userPublicSchemaResponse,
  userSocialLinkCreateSchemaRequest,
  userSocialLinkCreateSchemaResponse,
  userSocialLinksSchemaResponse,
  userUpdateSchemaRequest,
  usernameAvailableSchemaQuery,
  usernameAvailableSchemaResponse,
} from "./user.serializer"
import {
  commentTabSchemaResponse,
  overviewSchemaQuery,
  overviewSchemaResponse,
  postTabSchemaQuery,
  savedTabSchemaQuery,
  savedTabSchemaResponse,
} from "./user-tabs.serializer"

const TAB_PAGE_SIZE = 25

function encodeOverviewCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.getTime(), i: id })).toString("base64url")
}

function decodeOverviewCursor(cursor: string | null): { createdAt: Date; id: string } | null {
  if (!cursor) return null
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8")) as {
      c?: number
      i?: string
    }
    if (typeof parsed.c !== "number" || typeof parsed.i !== "string") return null
    const createdAt = new Date(parsed.c)
    if (Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id: parsed.i }
  } catch {
    return null
  }
}

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
  .get(
    "/by-username/:username/overview",
    authNoThrowMiddleware,
    describeRoute({
      description: "A user's posts and comments interleaved, newest first",
      responses: {
        200: {
          description: "User overview",
          content: { "application/json": { schema: resolver(overviewSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", userByUsernameSchemaParam),
    validator("query", overviewSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { username } = c.req.valid("param")
      const cursor = c.req.valid("query").cursor ?? null

      const profile = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!profile) return throwNotFound(c, "User not found")

      const decoded = decodeOverviewCursor(cursor)
      const { items, hasMore } = await fetchUserOverview(db).getPage({
        authorUserId: profile.id,
        cursorCreatedAt: decoded?.createdAt ?? null,
        cursorId: decoded?.id ?? null,
        limit: TAB_PAGE_SIZE,
      })

      const postRows = items.flatMap((i) => (i.kind === "post" ? [i.post] : []))
      const commentRows = items.flatMap((i) => (i.kind === "comment" ? [i.comment] : []))

      const [processedPosts, processedComments] = await Promise.all([
        processPosts(db, postRows, user?.id ?? null),
        buildCommentsWithPost(commentRows, user?.id ?? null),
      ])
      const postById = new Map(processedPosts.map((p) => [p.id, p]))
      const commentById = new Map(processedComments.map((cm) => [cm.id, cm]))

      type OverviewOut =
        | { kind: "post"; post: (typeof processedPosts)[number] }
        | { kind: "comment"; comment: (typeof processedComments)[number] }
      const data: OverviewOut[] = []
      for (const item of items) {
        if (item.kind === "post") {
          const post = postById.get(item.id)
          if (post) data.push({ kind: "post", post })
        } else {
          const comment = commentById.get(item.id)
          if (comment) data.push({ kind: "comment", comment })
        }
      }

      const last = items.at(-1)
      const nextCursor = hasMore && last ? encodeOverviewCursor(last.createdAt, last.id) : null

      return c.json({ data, nextCursor })
    },
  )
  .get(
    "/by-username/:username/social-links",
    describeRoute({
      description: "Public social links for a username",
      responses: {
        200: {
          description: "Social links",
          content: { "application/json": { schema: resolver(userSocialLinksSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", userByUsernameSchemaParam),
    async (c) => {
      const { username } = c.req.valid("param")
      const profile = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!profile) return throwNotFound(c, "User not found")

      const links = await fetchUserSocialLink(db).listByUserId(profile.id, [
        "id",
        "platform",
        "url",
        "label",
        "position",
      ])
      return c.json({ data: links })
    },
  )
  .get(
    "/by-username/:username/moderating",
    describeRoute({
      description: "Communities a user moderates",
      responses: {
        200: {
          description: "Moderated communities",
          content: { "application/json": { schema: resolver(userModeratingSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", userByUsernameSchemaParam),
    async (c) => {
      const { username } = c.req.valid("param")
      const profile = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!profile) return throwNotFound(c, "User not found")

      const data = await fetchCommunityModerator(db).getModeratingPublic(profile.id)
      return c.json({ data })
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
  .post(
    "/me/social-links",
    describeRoute({
      description: "Add a social link to the current user's profile",
      responses: {
        201: {
          description: "Social link created",
          content: {
            "application/json": { schema: resolver(userSocialLinkCreateSchemaResponse) },
          },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", userSocialLinkCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      const count = await fetchUserSocialLink(db).countByUserId(user.id)
      if (count >= 10) return throwBadRequest(c, "You can add at most 10 social links")

      const created = await crudUserSocialLink(db).create({
        userId: user.id,
        platform: body.platform,
        url: body.url,
        label: body.label ?? null,
        position: body.position ?? count,
      })
      return c.json({ id: created.id }, 201)
    },
  )
  .delete(
    "/me/social-links/:id",
    describeRoute({
      description: "Remove a social link from the current user's profile",
      responses: {
        200: {
          description: "Social link deleted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        404: {
          description: "Social link not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const deleted = await crudUserSocialLink(db).deleteOwn(id, user.id)
      if (!deleted) return throwNotFound(c, "Social link not found")
      return c.json({})
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
