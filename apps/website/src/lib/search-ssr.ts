import { fetchComment } from "@lib/dao/comment/fetch"
import { processComments, type ProcessedComment } from "@lib/dao/comment/processComment"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchPost, type RawPostRow } from "@lib/dao/post/fetch"
import { processPosts, type ProcessedPost } from "@lib/dao/post/processPost"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import {
  ensureSearchIndexes,
  searchComments,
  searchCommunities,
  searchPosts,
  searchUsers,
} from "@template-nextjs/search"

export const SEARCH_PAGE_SIZE = 25

export type SearchType = "posts" | "comments" | "communities" | "media" | "profiles"
export type SearchSort = "relevance" | "hot" | "top" | "new" | "comments"

const ANON = { access: { viewableCommunityIds: [] }, showMature: false, safeSearch: true }

export type CommunityCardData = {
  id: string
  name: string
  displayName: string | null
  description: string
  iconImageKey: string | null
  memberCount: number
  isNsfw: boolean
}

export type ProfileCardData = {
  id: string
  username: string
  displayName: string | null
  avatarImageKey: string | null
  about: string | null
  karma: number
}

export type CommentResultData = {
  comment: ProcessedComment
  postTitle: string
  communityId: string | null
  communityName: string | null
}

export type SsrSearchResult = {
  total: number
  posts: ProcessedPost[]
  comments: CommentResultData[]
  communities: CommunityCardData[]
  profiles: ProfileCardData[]
  communityId: string | null
  nextCursor: string | null
}

const EMPTY: SsrSearchResult = {
  total: 0,
  posts: [],
  comments: [],
  communities: [],
  profiles: [],
  communityId: null,
  nextCursor: null,
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

function firstNextCursor(total: number, pageCount: number): string | null {
  if (pageCount >= total) return null
  return Buffer.from(
    JSON.stringify({ o: SEARCH_PAGE_SIZE, p: "limit/offset", t: "string" }),
  ).toString("base64url")
}

function orderByIds<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return ids.map((id) => byId.get(id)).filter((r): r is T => r !== undefined)
}

export async function loadSearch(
  q: string,
  type: SearchType,
  sort: SearchSort,
  t: string | undefined,
  community?: string,
  author?: string,
): Promise<SsrSearchResult> {
  if (q.trim().length === 0) return EMPTY
  await ensureSearchIndexes()
  const createdAfter = windowStartIso(t)

  let communityId: string | null = null
  if (community) {
    const row = await fetchCommunity(db).getOneByName(community, ["id"])
    communityId = row?.id ?? null
  }

  if (type === "communities") {
    const res = await searchCommunities(q, { ...ANON, limit: SEARCH_PAGE_SIZE })
    const ids = res.results.map((r) => r.id)
    const rows = await fetchCommunity(db).getManyByIds(ids, [
      "id",
      "name",
      "displayName",
      "description",
      "iconImageKey",
      "memberCount",
      "isNsfw",
    ])
    return {
      ...EMPTY,
      total: res.total,
      communities: orderByIds(ids, rows),
      nextCursor: firstNextCursor(res.total, res.results.length),
    }
  }

  if (type === "profiles") {
    const res = await searchUsers(q, { limit: SEARCH_PAGE_SIZE })
    const ids = res.results.map((r) => r.id)
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
    return {
      ...EMPTY,
      total: res.total,
      profiles,
      nextCursor: firstNextCursor(res.total, res.results.length),
    }
  }

  if (type === "comments") {
    const res = await searchComments(q, {
      ...ANON,
      sort,
      createdAfter,
      communityId,
      authorUsername: author ?? null,
      limit: SEARCH_PAGE_SIZE,
    })
    const contextById = new Map(res.results.map((r) => [r.id, r.source]))
    const rawRows = (
      await Promise.all(res.results.map((r) => fetchComment(db).getRawById(r.id)))
    ).filter((r): r is NonNullable<typeof r> => r !== undefined)
    const processed = await processComments(db, rawRows, null)
    const comments = processed.map((comment) => {
      const ctx = contextById.get(comment.id)
      return {
        comment,
        postTitle: ctx?.post_title ?? "",
        communityId: ctx?.community_id ?? null,
        communityName: ctx?.community_name ?? null,
      }
    })
    return {
      ...EMPTY,
      total: res.total,
      comments,
      nextCursor: firstNextCursor(res.total, res.results.length),
    }
  }

  const res = await searchPosts(q, {
    ...ANON,
    sort,
    mediaOnly: type === "media",
    createdAfter,
    communityId,
    authorUsername: author ?? null,
    limit: SEARCH_PAGE_SIZE,
  })
  const ids = res.results.map((r) => r.id)
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
  const posts = await processPosts(db, ordered, null)
  return {
    ...EMPTY,
    total: res.total,
    posts,
    communityId,
    nextCursor: firstNextCursor(res.total, res.results.length),
  }
}
