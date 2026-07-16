import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, SelectQueryBuilder } from "kysely"

export type PostSort = "hot" | "new" | "top" | "controversial" | "rising"

export const POST_COLUMNS = [
  "post.id",
  "post.type",
  "post.title",
  "post.bodyMd",
  "post.linkUrl",
  "post.communityId",
  "post.profileUserId",
  "post.authorUserId",
  "post.isNsfw",
  "post.isSpoiler",
  "post.isOc",
  "post.isLocked",
  "post.stickyPosition",
  "post.flairTemplateId",
  "post.ups",
  "post.downs",
  "post.score",
  "post.commentCount",
  "post.viewCount",
  "post.shareCount",
  "post.createdAt",
  "post.editedAt",
] as const

export type RawPostRow = {
  id: string
  type: string
  title: string
  bodyMd: string | null
  linkUrl: string | null
  communityId: string | null
  profileUserId: string | null
  authorUserId: string
  isNsfw: boolean
  isSpoiler: boolean
  isOc: boolean
  isLocked: boolean
  stickyPosition: number | null
  flairTemplateId: string | null
  ups: number
  downs: number
  score: number
  commentCount: number
  viewCount: string
  shareCount: number
  createdAt: Date
  editedAt: Date | null
}

// biome-ignore lint/suspicious/noExplicitAny: query builder unions across sort branches
type PostQuery = SelectQueryBuilder<DB, any, RawPostRow>

export function fetchPost(db: Kysely<DB>) {
  function applyNonRisingSort(
    query: PostQuery,
    sort: Exclude<PostSort, "rising">,
    windowStart: Date | null,
  ): PostQuery {
    if (sort === "new") {
      return query.orderBy("post.createdAt", "desc").orderBy("post.id", "desc")
    }
    if (sort === "top") {
      return query
        .$if(windowStart !== null, (qb) => qb.where("post.createdAt", ">=", windowStart as Date))
        .orderBy("post.score", "desc")
        .orderBy("post.id", "desc")
    }
    if (sort === "controversial") {
      return query
        .$if(windowStart !== null, (qb) => qb.where("post.createdAt", ">=", windowStart as Date))
        .orderBy("post.controversialScore", "desc")
        .orderBy("post.id", "desc")
    }
    return query.orderBy("post.hotScore", "desc").orderBy("post.id", "desc")
  }

  function communityFeed(opts: {
    communityId: string
    sort: PostSort
    windowStart: Date | null
    excludeSticky: boolean
  }): PostQuery {
    if (opts.sort === "rising") {
      return db
        .selectFrom("post")
        .innerJoin("postRising", "postRising.postId", "post.id")
        .where("post.communityId", "=", opts.communityId)
        .where("post.removedAt", "is", null)
        .select(POST_COLUMNS)
        .orderBy("postRising.score", "desc")
        .orderBy("post.id", "desc")
    }
    const base = db
      .selectFrom("post")
      .where("post.communityId", "=", opts.communityId)
      .where("post.removedAt", "is", null)
      .$if(opts.excludeSticky, (qb) => qb.where("post.stickyPosition", "is", null))
      .select(POST_COLUMNS)
    return applyNonRisingSort(base, opts.sort, opts.windowStart)
  }

  function globalFeed(opts: { sort: PostSort; windowStart: Date | null }): PostQuery {
    if (opts.sort === "rising") {
      return db
        .selectFrom("post")
        .innerJoin("postRising", "postRising.postId", "post.id")
        .innerJoin("community", "community.id", "post.communityId")
        .where("community.visibility", "in", ["public", "restricted"])
        .where("post.removedAt", "is", null)
        .select(POST_COLUMNS)
        .orderBy("postRising.score", "desc")
        .orderBy("post.id", "desc")
    }
    const base = db
      .selectFrom("post")
      .innerJoin("community", "community.id", "post.communityId")
      .where("community.visibility", "in", ["public", "restricted"])
      .where("post.removedAt", "is", null)
      .select(POST_COLUMNS)
    return applyNonRisingSort(base, opts.sort, opts.windowStart)
  }

  function homeFeed(opts: {
    communityIds: string[]
    viewerId: string
    sort: PostSort
    windowStart: Date | null
    excludeViewed: boolean
  }): PostQuery {
    if (opts.sort === "rising") {
      return db
        .selectFrom("post")
        .innerJoin("postRising", "postRising.postId", "post.id")
        .where("post.communityId", "in", opts.communityIds)
        .where("post.removedAt", "is", null)
        .select(POST_COLUMNS)
        .orderBy("postRising.score", "desc")
        .orderBy("post.id", "desc")
    }
    const base = db
      .selectFrom("post")
      .$if(opts.excludeViewed, (qb) =>
        qb
          .leftJoin("postView", (join) =>
            join.onRef("postView.postId", "=", "post.id").on("postView.userId", "=", opts.viewerId),
          )
          .where("postView.postId", "is", null),
      )
      .where("post.communityId", "in", opts.communityIds)
      .where("post.removedAt", "is", null)
      .select(POST_COLUMNS)
    return applyNonRisingSort(base, opts.sort, opts.windowStart)
  }

  function profileFeed(profileUserId: string): PostQuery {
    return db
      .selectFrom("post")
      .where("post.profileUserId", "=", profileUserId)
      .where("post.removedAt", "is", null)
      .select(POST_COLUMNS)
      .orderBy("post.createdAt", "desc")
      .orderBy("post.id", "desc")
  }

  async function getStickyForCommunity(communityId: string): Promise<RawPostRow[]> {
    return (await db
      .selectFrom("post")
      .where("post.communityId", "=", communityId)
      .where("post.removedAt", "is", null)
      .where("post.stickyPosition", "is not", null)
      .select(POST_COLUMNS)
      .orderBy("post.stickyPosition", "asc")
      .execute()) as RawPostRow[]
  }

  async function getRawById(id: string): Promise<RawPostRow | undefined> {
    return (await db
      .selectFrom("post")
      .where("post.id", "=", id)
      .select(POST_COLUMNS)
      .executeTakeFirst()) as RawPostRow | undefined
  }

  async function getOne<T extends (keyof DB["post"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["post"]>, T[number]> | undefined> {
    return await db.selectFrom("post").select(fields).where("id", "=", id).executeTakeFirst()
  }

  return {
    communityFeed,
    globalFeed,
    homeFeed,
    profileFeed,
    getStickyForCommunity,
    getRawById,
    getOne,
  }
}
