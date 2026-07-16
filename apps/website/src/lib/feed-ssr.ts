import { fetchPost, type PostSort, type RawPostRow } from "@lib/dao/post/fetch"
import { processPosts, type ProcessedPost } from "@lib/dao/post/processPost"
import { db } from "@template-nextjs/db"

export const FEED_PAGE_SIZE = 25

export type SsrFeedResult = {
  posts: ProcessedPost[]
  /** Opaque cursor for the client to continue pagination via the API, or null. */
  initialCursor: string | null
}

/** Mirrors the API's offset cursor for the second page so the client can continue. */
function firstNextCursor(hasMore: boolean): string | null {
  if (!hasMore) return null
  return Buffer.from(
    JSON.stringify({ o: FEED_PAGE_SIZE, p: "limit/offset", t: "string" }),
  ).toString("base64url")
}

export function windowStartFor(t: string | undefined): Date | null {
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

export function normalizeSort(sort: string | undefined, allowed: readonly PostSort[]): PostSort {
  return allowed.includes(sort as PostSort) ? (sort as PostSort) : allowed[0]
}

export async function loadCommunityFeed(
  communityId: string,
  sort: PostSort,
  t: string | undefined,
  viewerId: string | null,
): Promise<SsrFeedResult> {
  const feedQuery = fetchPost(db).communityFeed({
    communityId,
    sort,
    windowStart: windowStartFor(t),
    excludeSticky: sort === "hot",
  })
  const rows = (await feedQuery.limit(FEED_PAGE_SIZE + 1).execute()) as RawPostRow[]
  const hasMore = rows.length > FEED_PAGE_SIZE
  const page = rows.slice(0, FEED_PAGE_SIZE)
  const stickyRows = sort === "hot" ? await fetchPost(db).getStickyForCommunity(communityId) : []
  const posts = await processPosts(db, [...stickyRows, ...page], viewerId)
  return { posts, initialCursor: firstNextCursor(hasMore) }
}

export async function loadPopularFeed(
  sort: PostSort,
  t: string | undefined,
  viewerId: string | null,
): Promise<SsrFeedResult> {
  const feedQuery = fetchPost(db).globalFeed({ sort, windowStart: windowStartFor(t) })
  const rows = (await feedQuery.limit(FEED_PAGE_SIZE + 1).execute()) as RawPostRow[]
  const hasMore = rows.length > FEED_PAGE_SIZE
  const posts = await processPosts(db, rows.slice(0, FEED_PAGE_SIZE), viewerId)
  return { posts, initialCursor: firstNextCursor(hasMore) }
}

export async function loadProfileFeed(
  profileUserId: string,
  viewerId: string | null,
): Promise<SsrFeedResult> {
  const feedQuery = fetchPost(db).profileFeed(profileUserId)
  const rows = (await feedQuery.limit(FEED_PAGE_SIZE + 1).execute()) as RawPostRow[]
  const hasMore = rows.length > FEED_PAGE_SIZE
  const posts = await processPosts(db, rows.slice(0, FEED_PAGE_SIZE), viewerId)
  return { posts, initialCursor: firstNextCursor(hasMore) }
}

export type OverviewComment = {
  id: string
  bodyMd: string | null
  score: number
  isDeleted: boolean
  createdAt: string
  editedAt: string | null
  post: {
    id: string
    title: string
    community: { id: string; name: string } | null
  }
}

export type ProfileOverviewItem =
  | { kind: "post"; sortAt: number; post: ProcessedPost }
  | { kind: "comment"; sortAt: number; comment: OverviewComment }

/**
 * First-page, intertwined overview for the anonymous SSR profile: the user's
 * posts and comments merged newest-first. Continuation (infinite scroll for the
 * mixed list) needs the API overview endpoint, so this returns a single page.
 */
export async function loadProfileOverview(
  profileUserId: string,
  viewerId: string | null,
): Promise<ProfileOverviewItem[]> {
  const postRows = (await fetchPost(db)
    .profileFeed(profileUserId)
    .limit(FEED_PAGE_SIZE)
    .execute()) as RawPostRow[]

  const commentRows = await db
    .selectFrom("comment")
    .innerJoin("post", "post.id", "comment.postId")
    .leftJoin("community", "community.id", "post.communityId")
    .where("comment.authorUserId", "=", profileUserId)
    .where("comment.isDeleted", "=", false)
    .where("comment.removedAt", "is", null)
    .select([
      "comment.id as id",
      "comment.bodyMd as bodyMd",
      "comment.score as score",
      "comment.isDeleted as isDeleted",
      "comment.createdAt as createdAt",
      "comment.editedAt as editedAt",
      "post.id as postId",
      "post.title as postTitle",
      "community.id as communityId",
      "community.name as communityName",
    ])
    .orderBy("comment.createdAt", "desc")
    .orderBy("comment.id", "desc")
    .limit(FEED_PAGE_SIZE)
    .execute()

  const posts = await processPosts(db, postRows, viewerId)

  const postItems: ProfileOverviewItem[] = posts.map((post) => ({
    kind: "post",
    sortAt: new Date(post.createdAt).getTime(),
    post,
  }))

  const commentItems: ProfileOverviewItem[] = commentRows.map((row) => ({
    kind: "comment",
    sortAt: new Date(row.createdAt).getTime(),
    comment: {
      id: row.id,
      bodyMd: row.bodyMd,
      score: row.score,
      isDeleted: row.isDeleted,
      createdAt: new Date(row.createdAt).toISOString(),
      editedAt: row.editedAt ? new Date(row.editedAt).toISOString() : null,
      post: {
        id: row.postId,
        title: row.postTitle,
        community:
          row.communityId && row.communityName
            ? { id: row.communityId, name: row.communityName }
            : null,
      },
    },
  }))

  return [...postItems, ...commentItems]
    .toSorted((a, b) => b.sortAt - a.sortAt)
    .slice(0, FEED_PAGE_SIZE)
}
