import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { crudCustomFeed } from "@lib/dao/customFeed/crud"
import { fetchCustomFeed } from "@lib/dao/customFeed/fetch"
import { crudCustomFeedCommunity } from "@lib/dao/customFeedCommunity/crud"
import { fetchCustomFeedCommunity } from "@lib/dao/customFeedCommunity/fetch"
import { fetchPost } from "@lib/dao/post/fetch"
import { processPosts } from "@lib/dao/post/processPost"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { cursorOffsetPaginate } from "../utils/pagination"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import { feedSchemaResponse } from "./feed.serializer"
import {
  customFeedCommunitySchemaParam,
  customFeedCreateSchemaRequest,
  customFeedCreateSchemaResponse,
  customFeedDetailSchemaResponse,
  customFeedIdSchemaParam,
  customFeedMineSchemaResponse,
  customFeedPostsSchemaQuery,
  customFeedUpdateSchemaRequest,
  customFeedUserSlugSchemaParam,
} from "./custom-feed.serializer"

const PAGE_SIZE = 25
const FEED_CAP = 100
const COMMUNITY_CAP = 100
const ICON_PREVIEW_COUNT = 4

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return base === "" ? "feed" : base
}

function uniqueSlug(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base
  let i = 2
  while (taken.includes(`${base}-${i}`)) i++
  return `${base}-${i}`
}

function windowStartFor(t: string | undefined): Date | null {
  const now = Date.now()
  switch (t) {
    case "hour":
      return new Date(now - 60 * 60 * 1000)
    case "day":
      return new Date(now - 24 * 60 * 60 * 1000)
    case "week":
      return new Date(now - 7 * 24 * 60 * 60 * 1000)
    case "month":
      return new Date(now - 30 * 24 * 60 * 60 * 1000)
    case "year":
      return new Date(now - 365 * 24 * 60 * 60 * 1000)
    default:
      return null
  }
}

const app = new Hono()
  .get(
    "/:username/:slug",
    authNoThrowMiddleware,
    describeRoute({
      description: "Public detail for a user's custom feed",
      responses: {
        200: {
          description: "Custom feed detail",
          content: { "application/json": { schema: resolver(customFeedDetailSchemaResponse) } },
        },
        404: {
          description: "Feed not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", customFeedUserSlugSchemaParam),
    async (c) => {
      const user = c.var.user
      const { username, slug } = c.req.valid("param")

      const owner = await fetchUser(db).getOneByUsername(username, ["id", "username"])
      if (!owner) return throwNotFound(c, "Feed not found")

      const feed = await fetchCustomFeed(db).getOneByOwnerSlug(owner.id, slug, [
        "id",
        "name",
        "slug",
        "description",
        "isFavorite",
      ])
      if (!feed) return throwNotFound(c, "Feed not found")

      const rows = await fetchCustomFeedCommunity(db).listForFeeds([feed.id])
      const communities = rows.map((r) => ({
        id: r.communityId,
        name: r.name,
        displayName: r.displayName,
        iconImageKey: r.iconImageKey,
        visibility: r.visibility,
      }))

      return c.json({
        id: feed.id,
        name: feed.name,
        slug: feed.slug,
        description: feed.description,
        isFavorite: feed.isFavorite,
        isOwner: user?.id === owner.id,
        owner: { username: owner.username },
        communities,
      })
    },
  )
  .get(
    "/:username/:slug/posts",
    authNoThrowMiddleware,
    describeRoute({
      description: "Posts across the communities in a custom feed",
      responses: {
        200: {
          description: "Custom feed posts",
          content: { "application/json": { schema: resolver(feedSchemaResponse) } },
        },
        404: {
          description: "Feed not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", customFeedUserSlugSchemaParam),
    validator("query", customFeedPostsSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { username, slug } = c.req.valid("param")
      const query = c.req.valid("query")
      const sort = query.sort ?? "hot"
      const cursor = query.cursor ?? null

      const owner = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!owner) return throwNotFound(c, "Feed not found")

      const feed = await fetchCustomFeed(db).getOneByOwnerSlug(owner.id, slug, ["id"])
      if (!feed) return throwNotFound(c, "Feed not found")

      const communityIds = await fetchCustomFeedCommunity(db).listCommunityIds(feed.id)
      if (communityIds.length === 0) return c.json({ data: [], nextCursor: null })

      const communities = await fetchCommunity(db).getManyByIds(communityIds, ["id", "visibility"])
      const visibleIds: string[] = []
      for (const community of communities) {
        if (community.visibility === "public" || community.visibility === "restricted") {
          visibleIds.push(community.id)
          continue
        }
        if (!user) continue
        const canView = await getCommunityAuthz(db).canView(
          { id: community.id, visibility: community.visibility },
          user.id,
        )
        if (canView.ok) visibleIds.push(community.id)
      }
      if (visibleIds.length === 0) return c.json({ data: [], nextCursor: null })

      const feedQuery = fetchPost(db).multiCommunityFeed({
        communityIds: visibleIds,
        sort,
        windowStart: windowStartFor(query.t),
        viewerId: user?.id ?? null,
      })

      const { results, nextCursor } = await cursorOffsetPaginate({
        query: feedQuery,
        cursor,
        ordering: "id",
        positionColumn: "post.id",
        pageSize: PAGE_SIZE,
      })

      const processed = await processPosts(db, results, user?.id ?? null)
      return c.json({ data: processed, nextCursor })
    },
  )
  .use(authMiddleware)
  .get(
    "/mine",
    describeRoute({
      description: "The current user's custom feeds",
      responses: {
        200: {
          description: "Custom feeds",
          content: { "application/json": { schema: resolver(customFeedMineSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const feeds = await fetchCustomFeed(db).listForOwner(user.id, [
        "id",
        "name",
        "slug",
        "description",
        "isFavorite",
      ])
      const rows = await fetchCustomFeedCommunity(db).listForFeeds(feeds.map((f) => f.id))

      return c.json({
        data: feeds.map((feed) => {
          const communities = rows.filter((r) => r.customFeedId === feed.id)
          return {
            id: feed.id,
            name: feed.name,
            slug: feed.slug,
            description: feed.description,
            isFavorite: feed.isFavorite,
            communityCount: communities.length,
            communities: communities
              .slice(0, ICON_PREVIEW_COUNT)
              .map((r) => ({ name: r.name, iconImageKey: r.iconImageKey })),
          }
        }),
      })
    },
  )
  .post(
    "/",
    describeRoute({
      description: "Create a custom feed",
      responses: {
        201: {
          description: "Feed created",
          content: { "application/json": { schema: resolver(customFeedCreateSchemaResponse) } },
        },
        400: {
          description: "Feed limit reached",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", customFeedCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      const count = await fetchCustomFeed(db).countForOwner(user.id)
      if (count >= FEED_CAP) {
        return throwBadRequest(c, "You have reached the custom feed limit")
      }

      const taken = await fetchCustomFeed(db).slugsForOwner(user.id)
      const slug = uniqueSlug(slugify(body.name), taken)

      const feed = await crudCustomFeed(db).create({
        ownerUserId: user.id,
        name: body.name,
        slug,
        description: body.description ?? null,
      })

      return c.json({ id: feed.id, slug: feed.slug }, 201)
    },
  )
  .patch(
    "/:id",
    describeRoute({
      description: "Update a custom feed (owner only)",
      responses: {
        200: {
          description: "Feed updated",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not the owner",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Feed not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", customFeedIdSchemaParam),
    validator("json", customFeedUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const feed = await fetchCustomFeed(db).getOne(id, ["ownerUserId", "slug"])
      if (!feed) return throwNotFound(c, "Feed not found")
      if (feed.ownerUserId !== user.id) return throwForbidden(c, "Not your feed")

      const data: {
        name?: string
        slug?: string
        description?: string | null
        isFavorite?: boolean
      } = {}
      if (body.name !== undefined) {
        data.name = body.name
        const taken = (await fetchCustomFeed(db).slugsForOwner(user.id)).filter(
          (s) => s !== feed.slug,
        )
        data.slug = uniqueSlug(slugify(body.name), taken)
      }
      if (body.description !== undefined) data.description = body.description
      if (body.isFavorite !== undefined) data.isFavorite = body.isFavorite

      await crudCustomFeed(db).update(id, data)
      return c.json({})
    },
  )
  .delete(
    "/:id",
    describeRoute({
      description: "Delete a custom feed (owner only)",
      responses: {
        200: {
          description: "Feed deleted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not the owner",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Feed not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", customFeedIdSchemaParam),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const feed = await fetchCustomFeed(db).getOne(id, ["ownerUserId"])
      if (!feed) return throwNotFound(c, "Feed not found")
      if (feed.ownerUserId !== user.id) return throwForbidden(c, "Not your feed")

      await crudCustomFeed(db).deleteOne(id)
      return c.json({})
    },
  )
  .put(
    "/:id/community/:communityId",
    describeRoute({
      description: "Add a community to a custom feed (owner only)",
      responses: {
        200: {
          description: "Community added",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        400: {
          description: "Community limit reached",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        403: {
          description: "Not the owner or cannot view community",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Feed or community not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", customFeedCommunitySchemaParam),
    async (c) => {
      const user = c.var.user
      const { id, communityId } = c.req.valid("param")

      const feed = await fetchCustomFeed(db).getOne(id, ["ownerUserId"])
      if (!feed) return throwNotFound(c, "Feed not found")
      if (feed.ownerUserId !== user.id) return throwForbidden(c, "Not your feed")

      const community = await fetchCommunity(db).getOne(communityId, ["id", "visibility"])
      if (!community) return throwNotFound(c, "Community not found")

      const canView = await getCommunityAuthz(db).canView(
        { id: community.id, visibility: community.visibility },
        user.id,
      )
      if (!canView.ok) return throwForbidden(c, "You cannot add this community")

      const count = await fetchCustomFeedCommunity(db).countForFeed(id)
      if (count >= COMMUNITY_CAP) {
        return throwBadRequest(c, "This feed has reached the community limit")
      }

      await crudCustomFeedCommunity(db).add(id, communityId)
      return c.json({})
    },
  )
  .delete(
    "/:id/community/:communityId",
    describeRoute({
      description: "Remove a community from a custom feed (owner only)",
      responses: {
        200: {
          description: "Community removed",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not the owner",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Feed not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", customFeedCommunitySchemaParam),
    async (c) => {
      const user = c.var.user
      const { id, communityId } = c.req.valid("param")

      const feed = await fetchCustomFeed(db).getOne(id, ["ownerUserId"])
      if (!feed) return throwNotFound(c, "Feed not found")
      if (feed.ownerUserId !== user.id) return throwForbidden(c, "Not your feed")

      await crudCustomFeedCommunity(db).remove(id, communityId)
      return c.json({})
    },
  )

export default app
