import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchCommunityMember } from "@lib/dao/communityMember/fetch"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { fetchPost, type PostSort, type RawPostRow } from "@lib/dao/post/fetch"
import { processPosts, type ProcessedPost } from "@lib/dao/post/processPost"
import { fetchUser } from "@lib/dao/user/fetch"
import { fetchUserFollow } from "@lib/dao/userFollow/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { cursorOffsetPaginate } from "../utils/pagination"
import { throwNotFound } from "../utils/http-exception"
import {
  feedNameSchemaParam,
  feedSchemaQuery,
  feedSchemaResponse,
  feedUsernameSchemaParam,
  homeFeedSchemaQuery,
} from "./feed.serializer"

const PAGE_SIZE = 25
const HOME_CONSECUTIVE_CAP = 3

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

function capConsecutive(posts: ProcessedPost[], max: number): ProcessedPost[] {
  const result: ProcessedPost[] = []
  const pending = [...posts]
  while (pending.length > 0) {
    const lastCommunity = result.length > 0 ? result[result.length - 1].community?.id : null
    let runLength = 0
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].community?.id === lastCommunity) runLength++
      else break
    }
    let index = 0
    if (runLength >= max) {
      const alt = pending.findIndex((p) => (p.community?.id ?? null) !== lastCommunity)
      if (alt !== -1) index = alt
    }
    result.push(pending.splice(index, 1)[0])
  }
  return result
}

const app = new Hono()
  .get(
    "/community/:name",
    authNoThrowMiddleware,
    describeRoute({
      description: "Feed of posts for a community",
      responses: {
        200: {
          description: "Community feed",
          content: { "application/json": { schema: resolver(feedSchemaResponse) } },
        },
        404: {
          description: "Community not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", feedNameSchemaParam),
    validator("query", feedSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { name } = c.req.valid("param")
      const query = c.req.valid("query")
      const sort = query.sort ?? "hot"
      const cursor = query.cursor ?? null

      const community = await fetchCommunity(db).getOneByName(name, ["id", "visibility"])
      if (!community) return throwNotFound(c, "Community not found")

      const view = await getCommunityAuthz(db).canView(
        { id: community.id, visibility: community.visibility },
        user?.id ?? null,
      )
      if (!view.ok) return throwNotFound(c, "Community not found")

      const feedQuery = fetchPost(db).communityFeed({
        communityId: community.id,
        sort,
        windowStart: windowStartFor(query.t),
        excludeSticky: sort === "hot",
        viewerId: user?.id ?? null,
        flairTemplateId: query.flairTemplateId ?? null,
      })

      const { results, nextCursor } = await cursorOffsetPaginate({
        query: feedQuery,
        cursor,
        ordering: "id",
        positionColumn: "post.id",
        pageSize: PAGE_SIZE,
      })

      let stickyRows: RawPostRow[] = []
      if (sort === "hot" && !cursor) {
        stickyRows = await fetchPost(db).getStickyForCommunity(community.id)
      }

      const processed = await processPosts(db, [...stickyRows, ...results], user?.id ?? null)

      return c.json({ data: processed, nextCursor })
    },
  )
  .get(
    "/popular",
    authNoThrowMiddleware,
    describeRoute({
      description: "Popular feed across all public and restricted communities",
      responses: {
        200: {
          description: "Popular feed",
          content: { "application/json": { schema: resolver(feedSchemaResponse) } },
        },
      },
    }),
    validator("query", feedSchemaQuery),
    async (c) => {
      const user = c.var.user
      const query = c.req.valid("query")
      const sort = query.sort ?? "hot"
      const cursor = query.cursor ?? null

      const feedQuery = fetchPost(db).globalFeed({
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
  .get(
    "/home",
    authMiddleware,
    describeRoute({
      description: "Personalized home feed from joined communities",
      responses: {
        200: {
          description: "Home feed",
          content: { "application/json": { schema: resolver(feedSchemaResponse) } },
        },
      },
    }),
    validator("query", homeFeedSchemaQuery),
    async (c) => {
      const user = c.var.user
      const query = c.req.valid("query")
      const homeSort = query.sort ?? "best"
      const cursor = query.cursor ?? null

      const memberships = await fetchCommunityMember(db).getManyForUser(user.id)
      const communityIds = memberships.map((m) => m.id)
      const followedUserIds = await fetchUserFollow(db).listFollowedIds(user.id)
      if (communityIds.length === 0 && followedUserIds.length === 0) {
        return c.json({ data: [], nextCursor: null })
      }

      const sort: PostSort = homeSort === "best" ? "hot" : homeSort
      const excludeViewed = homeSort === "best"

      const feedQuery = fetchPost(db).homeFeed({
        communityIds,
        viewerId: user.id,
        sort,
        windowStart: windowStartFor(query.t),
        excludeViewed,
        followedUserIds,
      })

      const { results, nextCursor } = await cursorOffsetPaginate({
        query: feedQuery,
        cursor,
        ordering: "id",
        positionColumn: "post.id",
        pageSize: PAGE_SIZE,
      })

      let processed = await processPosts(db, results, user.id)
      if (homeSort === "best") processed = capConsecutive(processed, HOME_CONSECUTIVE_CAP)

      return c.json({ data: processed, nextCursor })
    },
  )
  .get(
    "/mod",
    authMiddleware,
    describeRoute({
      description: "Aggregate feed of posts across every community the viewer moderates",
      responses: {
        200: {
          description: "Moderated communities feed",
          content: { "application/json": { schema: resolver(feedSchemaResponse) } },
        },
      },
    }),
    validator("query", feedSchemaQuery),
    async (c) => {
      const user = c.var.user
      const query = c.req.valid("query")
      const sort = query.sort ?? "hot"
      const cursor = query.cursor ?? null

      const moderated = await fetchCommunityModerator(db).getManyForUser(user.id)
      const communityIds = moderated.map((m) => m.id)
      if (communityIds.length === 0) return c.json({ data: [], nextCursor: null })

      const feedQuery = fetchPost(db).multiCommunityFeed({
        communityIds,
        sort,
        windowStart: windowStartFor(query.t),
        viewerId: user.id,
      })

      const { results, nextCursor } = await cursorOffsetPaginate({
        query: feedQuery,
        cursor,
        ordering: "id",
        positionColumn: "post.id",
        pageSize: PAGE_SIZE,
      })

      const processed = await processPosts(db, results, user.id)
      return c.json({ data: processed, nextCursor })
    },
  )
  .get(
    "/profile/:username",
    authNoThrowMiddleware,
    describeRoute({
      description: "A user's profile posts",
      responses: {
        200: {
          description: "Profile feed",
          content: { "application/json": { schema: resolver(feedSchemaResponse) } },
        },
        404: {
          description: "User not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", feedUsernameSchemaParam),
    validator("query", feedSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { username } = c.req.valid("param")
      const query = c.req.valid("query")
      const cursor = query.cursor ?? null

      const profile = await fetchUser(db).getOneByUsername(username, ["id"])
      if (!profile) return throwNotFound(c, "User not found")

      const rawSort = query.sort ?? "new"
      const sort: Exclude<PostSort, "rising"> = rawSort === "rising" ? "new" : rawSort

      const feedQuery = fetchPost(db).authoredPostsFeed({
        authorUserId: profile.id,
        sort,
        windowStart: windowStartFor(query.t),
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

export default app
