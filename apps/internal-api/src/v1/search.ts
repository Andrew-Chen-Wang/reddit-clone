import { fetchComment } from "@lib/dao/comment/fetch"
import { processComments } from "@lib/dao/comment/processComment"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchCommunityMember } from "@lib/dao/communityMember/fetch"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { fetchPost, type RawPostRow } from "@lib/dao/post/fetch"
import { processPosts } from "@lib/dao/post/processPost"
import { fetchUser } from "@lib/dao/user/fetch"
import { fetchUserSettings } from "@lib/dao/userSettings/fetch"
import { db } from "@template-nextjs/db"
import {
  type ContentSort,
  ensureSearchIndexes,
  searchComments,
  searchCommunities,
  searchPosts,
  searchUsers,
  type SearchResults,
  suggestCommunities,
  suggestUsers,
} from "@template-nextjs/search"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authNoThrowMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { decodeCursor } from "../utils/pagination"
import {
  searchSchemaQuery,
  searchSchemaResponse,
  searchSuggestSchemaQuery,
  searchSuggestSchemaResponse,
} from "./search.serializer"

const PAGE_SIZE = 25

interface ViewerContext {
  viewableCommunityIds: string[]
  showMature: boolean
  safeSearch: boolean
}

async function resolveViewer(userId: string | null): Promise<ViewerContext> {
  if (!userId) {
    return { viewableCommunityIds: [], showMature: false, safeSearch: true }
  }
  const [memberships, moderated, settings] = await Promise.all([
    fetchCommunityMember(db).getManyForUser(userId),
    fetchCommunityModerator(db).getManyForUser(userId),
    fetchUserSettings(db).getOne(userId, ["showMature", "safeSearch"]),
  ])
  const viewableCommunityIds = [
    ...new Set([...memberships.map((m) => m.id), ...moderated.map((m) => m.id)]),
  ]
  return {
    viewableCommunityIds,
    showMature: settings?.showMature ?? false,
    safeSearch: settings?.safeSearch ?? true,
  }
}

function windowStartIso(t: string | undefined): string | null {
  const now = Date.now()
  switch (t) {
    case "hour":
      return new Date(now - 60 * 60 * 1000).toISOString()
    case "day":
      return new Date(now - 24 * 60 * 60 * 1000).toISOString()
    case "week":
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    case "month":
      return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
    case "year":
      return new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return null
  }
}

function readOffset(cursor: string | null): number {
  if (!cursor) return 0
  try {
    return decodeCursor(cursor).offset
  } catch {
    return 0
  }
}

function encodeOffset(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset, p: "limit/offset", t: "string" })).toString(
    "base64url",
  )
}

function nextOffsetCursor(offset: number, pageCount: number, total: number): string | null {
  return offset + pageCount < total ? encodeOffset(offset + PAGE_SIZE) : null
}

function orderByIds<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return ids.map((id) => byId.get(id)).filter((r): r is T => r !== undefined)
}

function emptyResponse(type: string, results: SearchResults<unknown>, offset: number) {
  return {
    type,
    total: results.total,
    posts: [],
    comments: [],
    communities: [],
    profiles: [],
    nextCursor: nextOffsetCursor(offset, results.results.length, results.total),
  }
}

const app = new Hono()
  .get(
    "/",
    authNoThrowMiddleware,
    describeRoute({
      description: "Full-text search across posts, comments, communities and profiles",
      responses: {
        200: {
          description: "Search results",
          content: { "application/json": { schema: resolver(searchSchemaResponse) } },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("query", searchSchemaQuery),
    async (c) => {
      await ensureSearchIndexes()
      const user = c.var.user
      const query = c.req.valid("query")
      const type = query.type ?? "posts"
      const sort: ContentSort = query.sort ?? "relevance"
      const offset = readOffset(query.cursor ?? null)
      const viewer = await resolveViewer(user?.id ?? null)
      const access = { viewableCommunityIds: viewer.viewableCommunityIds }

      if (type === "communities") {
        const results = await searchCommunities(query.q, {
          access,
          showMature: viewer.showMature,
          safeSearch: viewer.safeSearch,
          limit: PAGE_SIZE,
          offset,
        })
        const ids = results.results.map((r) => r.id)
        const rows = await fetchCommunity(db).getManyByIds(ids, [
          "id",
          "name",
          "displayName",
          "description",
          "iconImageKey",
          "memberCount",
          "isNsfw",
        ])
        return c.json({
          ...emptyResponse(type, results, offset),
          communities: orderByIds(ids, rows),
        })
      }

      if (type === "profiles") {
        const results = await searchUsers(query.q, { limit: PAGE_SIZE, offset })
        const ids = results.results.map((r) => r.id)
        const rows = await Promise.all(
          ids.map((id) =>
            fetchUser(db).getOne(id, [
              "id",
              "username",
              "displayName",
              "avatarImageKey",
              "about",
              "postKarma",
              "commentKarma",
            ]),
          ),
        )
        const profiles = rows
          .filter((r): r is NonNullable<typeof r> => r !== undefined)
          .map((r) => ({
            id: r.id,
            username: r.username,
            displayName: r.displayName,
            avatarImageKey: r.avatarImageKey,
            about: r.about,
            karma: r.postKarma + r.commentKarma,
          }))
        return c.json({ ...emptyResponse(type, results, offset), profiles })
      }

      if (type === "comments") {
        const results = await searchComments(query.q, {
          access,
          showMature: viewer.showMature,
          safeSearch: viewer.safeSearch,
          sort,
          communityId: query.communityId ?? null,
          authorUsername: query.authorUsername ?? null,
          postId: query.postId ?? null,
          createdAfter: windowStartIso(query.t),
          limit: PAGE_SIZE,
          offset,
        })
        const contextById = new Map(results.results.map((r) => [r.id, r.source]))
        const rawRows = (
          await Promise.all(results.results.map((r) => fetchComment(db).getRawById(r.id)))
        ).filter((r): r is NonNullable<typeof r> => r !== undefined)
        const processed = await processComments(db, rawRows, user?.id ?? null)
        const comments = processed.map((comment) => {
          const ctx = contextById.get(comment.id)
          return {
            comment,
            postTitle: ctx?.post_title ?? "",
            communityId: ctx?.community_id ?? null,
            communityName: ctx?.community_name ?? null,
          }
        })
        return c.json({ ...emptyResponse(type, results, offset), comments })
      }

      const results = await searchPosts(query.q, {
        access,
        showMature: viewer.showMature,
        safeSearch: viewer.safeSearch,
        sort,
        communityId: query.communityId ?? null,
        authorUsername: query.authorUsername ?? null,
        mediaOnly: type === "media",
        createdAfter: windowStartIso(query.t),
        limit: PAGE_SIZE,
        offset,
      })
      const ids = results.results.map((r) => r.id)
      const rows = await fetchPost(db).getManyByIds(ids, [
        "id",
        "type",
        "title",
        "bodyMd",
        "linkUrl",
        "communityId",
        "profileUserId",
        "authorUserId",
        "isNsfw",
        "isSpoiler",
        "isOc",
        "isLocked",
        "stickyPosition",
        "flairTemplateId",
        "ups",
        "downs",
        "score",
        "commentCount",
        "viewCount",
        "shareCount",
        "createdAt",
        "editedAt",
      ])
      const ordered = orderByIds(ids, rows) as unknown as RawPostRow[]
      const posts = await processPosts(db, ordered, user?.id ?? null)
      return c.json({ ...emptyResponse(type, results, offset), posts })
    },
  )
  .get(
    "/suggest",
    authNoThrowMiddleware,
    describeRoute({
      description: "Typeahead suggestions for communities and profiles",
      responses: {
        200: {
          description: "Suggestions",
          content: { "application/json": { schema: resolver(searchSuggestSchemaResponse) } },
        },
      },
    }),
    validator("query", searchSuggestSchemaQuery),
    async (c) => {
      await ensureSearchIndexes()
      const user = c.var.user
      const query = c.req.valid("query")
      const viewer = await resolveViewer(user?.id ?? null)
      const access = { viewableCommunityIds: viewer.viewableCommunityIds }

      const [communities, profiles] = await Promise.all([
        suggestCommunities(query.q, {
          access,
          showMature: viewer.showMature,
          safeSearch: viewer.safeSearch,
          limit: 5,
        }),
        suggestUsers(query.q, { limit: 3 }),
      ])

      return c.json({
        communities: communities.results.map((r) => ({
          id: r.id,
          name: r.source.name,
          displayName: r.source.display_name,
          memberCount: r.source.member_count,
          isNsfw: r.source.is_nsfw,
        })),
        profiles: profiles.results.map((r) => ({
          id: r.id,
          username: r.source.username,
          displayName: r.source.display_name,
        })),
      })
    },
  )

export default app
