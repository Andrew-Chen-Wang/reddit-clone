import type { DB } from "@template-nextjs/db"
import type {
  ExpressionBuilder,
  ExpressionWrapper,
  Kysely,
  Selectable,
  SelectQueryBuilder,
  SqlBool,
} from "kysely"

export type PostSort = "hot" | "new" | "top" | "controversial" | "rising"

export type ModQueueTab = "needs_review" | "reported" | "removed" | "edited" | "unmoderated"

export const POST_COLUMNS = [
  "post.id",
  "post.type",
  "post.title",
  "post.bodyMd",
  "post.linkUrl",
  "post.linkImageKey",
  "post.communityId",
  "post.profileUserId",
  "post.authorUserId",
  "post.slug",
  "post.crosspostOfPostId",
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
  linkImageKey: string | null
  communityId: string | null
  profileUserId: string | null
  authorUserId: string
  slug: string | null
  crosspostOfPostId: string | null
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

export const MOD_POST_COLUMNS = [
  ...POST_COLUMNS,
  "post.removedAt",
  "post.removedByUserId",
  "post.removalReasonId",
  "post.isSpam",
  "post.approvedAt",
] as const

export type ModPostRow = RawPostRow & {
  removedAt: Date | null
  removedByUserId: string | null
  removalReasonId: string | null
  isSpam: boolean
  approvedAt: Date | null
}

// biome-ignore lint/suspicious/noExplicitAny: query builder unions across sort branches
type PostQuery = SelectQueryBuilder<DB, any, RawPostRow>

function withMediaGuard(query: PostQuery): PostQuery {
  return query.where((eb) =>
    eb.or([
      eb("post.type", "!=", "media"),
      eb.exists(
        eb
          .selectFrom("postMedia")
          .select("postMedia.id")
          .whereRef("postMedia.postId", "=", "post.id")
          .where("postMedia.uploadStatus", "=", "completed"),
      ),
    ]),
  )
}

function applyViewerExclusions(query: PostQuery, viewerId: string): PostQuery {
  return query
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("postHide")
            .select("postHide.userId")
            .whereRef("postHide.postId", "=", "post.id")
            .where("postHide.userId", "=", viewerId),
        ),
      ),
    )
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("userMutedCommunity")
            .select("userMutedCommunity.userId")
            .whereRef("userMutedCommunity.communityId", "=", "post.communityId")
            .where("userMutedCommunity.userId", "=", viewerId),
        ),
      ),
    )
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("userBlock")
            .select("userBlock.blockerUserId")
            .where((inner) =>
              inner.or([
                inner.and([
                  inner("userBlock.blockerUserId", "=", viewerId),
                  inner("userBlock.blockedUserId", "=", inner.ref("post.authorUserId")),
                ]),
                inner.and([
                  inner("userBlock.blockerUserId", "=", inner.ref("post.authorUserId")),
                  inner("userBlock.blockedUserId", "=", viewerId),
                ]),
              ]),
            ),
        ),
      ),
    )
}

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
      .$if(windowStart !== null, (qb) => qb.where("post.createdAt", ">=", windowStart!))
      .orderBy("post.score", "desc")
      .orderBy("post.id", "desc")
  }
  if (sort === "controversial") {
    return query
      .$if(windowStart !== null, (qb) => qb.where("post.createdAt", ">=", windowStart!))
      .orderBy("post.controversialScore", "desc")
      .orderBy("post.id", "desc")
  }
  return query.orderBy("post.hotScore", "desc").orderBy("post.id", "desc")
}

function hasPendingReport(
  eb: ExpressionBuilder<DB, "post">,
): ExpressionWrapper<DB, "post", SqlBool> {
  return eb.exists(
    eb
      .selectFrom("postReport")
      .select("postReport.id")
      .whereRef("postReport.postId", "=", "post.id")
      .where("postReport.status", "=", "pending"),
  )
}

export function fetchPost(db: Kysely<DB>) {
  function communityFeed(opts: {
    communityId: string
    sort: PostSort
    windowStart: Date | null
    excludeSticky: boolean
    viewerId?: string | null
    flairTemplateId?: string | null
  }): PostQuery {
    const flairId = opts.flairTemplateId ?? null
    const exclude = (q: PostQuery): PostQuery =>
      opts.viewerId ? applyViewerExclusions(q, opts.viewerId) : q
    if (opts.sort === "rising") {
      return exclude(
        withMediaGuard(
          db
            .selectFrom("post")
            .innerJoin("postRising", "postRising.postId", "post.id")
            .where("post.communityId", "=", opts.communityId)
            .where("post.removedAt", "is", null)
            .$if(flairId !== null, (qb) => qb.where("post.flairTemplateId", "=", flairId))
            .select(POST_COLUMNS)
            .orderBy("postRising.score", "desc")
            .orderBy("post.id", "desc"),
        ),
      )
    }
    const base = withMediaGuard(
      db
        .selectFrom("post")
        .where("post.communityId", "=", opts.communityId)
        .where("post.removedAt", "is", null)
        .$if(opts.excludeSticky, (qb) => qb.where("post.stickyPosition", "is", null))
        .$if(flairId !== null, (qb) => qb.where("post.flairTemplateId", "=", flairId))
        .select(POST_COLUMNS),
    )
    return exclude(applyNonRisingSort(base, opts.sort, opts.windowStart))
  }

  function multiCommunityFeed(opts: {
    communityIds: string[]
    sort: PostSort
    windowStart: Date | null
    viewerId?: string | null
  }): PostQuery {
    const exclude = (q: PostQuery): PostQuery =>
      opts.viewerId ? applyViewerExclusions(q, opts.viewerId) : q
    if (opts.sort === "rising") {
      return exclude(
        withMediaGuard(
          db
            .selectFrom("post")
            .innerJoin("postRising", "postRising.postId", "post.id")
            .where("post.communityId", "in", opts.communityIds)
            .where("post.removedAt", "is", null)
            .select(POST_COLUMNS)
            .orderBy("postRising.score", "desc")
            .orderBy("post.id", "desc"),
        ),
      )
    }
    const base = withMediaGuard(
      db
        .selectFrom("post")
        .where("post.communityId", "in", opts.communityIds)
        .where("post.removedAt", "is", null)
        .select(POST_COLUMNS),
    )
    return exclude(applyNonRisingSort(base, opts.sort, opts.windowStart))
  }

  function globalFeed(opts: {
    sort: PostSort
    windowStart: Date | null
    viewerId?: string | null
  }): PostQuery {
    const exclude = (q: PostQuery): PostQuery =>
      opts.viewerId ? applyViewerExclusions(q, opts.viewerId) : q
    if (opts.sort === "rising") {
      return exclude(
        withMediaGuard(
          db
            .selectFrom("post")
            .innerJoin("postRising", "postRising.postId", "post.id")
            .innerJoin("community", "community.id", "post.communityId")
            .where("community.visibility", "in", ["public", "restricted"])
            .where("post.removedAt", "is", null)
            .select(POST_COLUMNS)
            .orderBy("postRising.score", "desc")
            .orderBy("post.id", "desc"),
        ),
      )
    }
    const base = withMediaGuard(
      db
        .selectFrom("post")
        .innerJoin("community", "community.id", "post.communityId")
        .where("community.visibility", "in", ["public", "restricted"])
        .where("post.removedAt", "is", null)
        .select(POST_COLUMNS),
    )
    return exclude(applyNonRisingSort(base, opts.sort, opts.windowStart))
  }

  function homeFeed(opts: {
    communityIds: string[]
    viewerId: string
    sort: PostSort
    windowStart: Date | null
    excludeViewed: boolean
    followedUserIds: string[]
  }): PostQuery {
    const hasCommunities = opts.communityIds.length > 0
    const hasFollowed = opts.followedUserIds.length > 0
    const candidateWhere = (qb: PostQuery): PostQuery =>
      qb.where((eb) =>
        eb.or([
          ...(hasCommunities ? [eb("post.communityId", "in", opts.communityIds)] : []),
          ...(hasFollowed ? [eb("post.profileUserId", "in", opts.followedUserIds)] : []),
        ]),
      )
    if (opts.sort === "rising") {
      return applyViewerExclusions(
        candidateWhere(
          withMediaGuard(
            db
              .selectFrom("post")
              .innerJoin("postRising", "postRising.postId", "post.id")
              .where("post.removedAt", "is", null)
              .select(POST_COLUMNS)
              .orderBy("postRising.score", "desc")
              .orderBy("post.id", "desc"),
          ),
        ),
        opts.viewerId,
      )
    }
    const base = candidateWhere(
      withMediaGuard(
        db
          .selectFrom("post")
          .$if(opts.excludeViewed, (qb) =>
            qb
              .leftJoin("postView", (join) =>
                join
                  .onRef("postView.postId", "=", "post.id")
                  .on("postView.userId", "=", opts.viewerId),
              )
              .where("postView.postId", "is", null),
          )
          .where("post.removedAt", "is", null)
          .select(POST_COLUMNS),
      ),
    )
    return applyViewerExclusions(
      applyNonRisingSort(base, opts.sort, opts.windowStart),
      opts.viewerId,
    )
  }

  function savedPostsFeed(userId: string): PostQuery {
    return db
      .selectFrom("post")
      .innerJoin("postSave", "postSave.postId", "post.id")
      .where("postSave.userId", "=", userId)
      .where("post.removedAt", "is", null)
      .select(POST_COLUMNS)
      .orderBy("postSave.createdAt", "desc")
      .orderBy("post.id", "desc")
  }

  function hiddenPostsFeed(userId: string): PostQuery {
    return db
      .selectFrom("post")
      .innerJoin("postHide", "postHide.postId", "post.id")
      .where("postHide.userId", "=", userId)
      .where("post.removedAt", "is", null)
      .select(POST_COLUMNS)
      .orderBy("postHide.createdAt", "desc")
      .orderBy("post.id", "desc")
  }

  function votedPostsFeed(userId: string, value: number): PostQuery {
    return db
      .selectFrom("post")
      .innerJoin("postVote", "postVote.postId", "post.id")
      .where("postVote.userId", "=", userId)
      .where("postVote.value", "=", value)
      .where("post.removedAt", "is", null)
      .select(POST_COLUMNS)
      .orderBy("postVote.updatedAt", "desc")
      .orderBy("post.id", "desc")
  }

  function authoredPostsFeed(opts: {
    authorUserId: string
    sort: Exclude<PostSort, "rising">
    windowStart: Date | null
  }): PostQuery {
    const base = withMediaGuard(
      db
        .selectFrom("post")
        .where("post.authorUserId", "=", opts.authorUserId)
        .where("post.removedAt", "is", null)
        .select(POST_COLUMNS),
    )
    return applyNonRisingSort(base, opts.sort, opts.windowStart)
  }

  function viewedPostsFeed(userId: string): PostQuery {
    return db
      .selectFrom("post")
      .innerJoin("postView", "postView.postId", "post.id")
      .where("postView.userId", "=", userId)
      .where("post.removedAt", "is", null)
      .select(POST_COLUMNS)
      .orderBy("postView.viewedAt", "desc")
      .orderBy("post.id", "desc")
  }

  function profileFeed(profileUserId: string): PostQuery {
    return withMediaGuard(
      db
        .selectFrom("post")
        .where("post.profileUserId", "=", profileUserId)
        .where("post.removedAt", "is", null)
        .select(POST_COLUMNS)
        .orderBy("post.createdAt", "desc")
        .orderBy("post.id", "desc"),
    )
  }

  async function getStickyForCommunity(communityId: string): Promise<RawPostRow[]> {
    return await withMediaGuard(
      db
        .selectFrom("post")
        .where("post.communityId", "=", communityId)
        .where("post.removedAt", "is", null)
        .where("post.stickyPosition", "is not", null)
        .select(POST_COLUMNS)
        .orderBy("post.stickyPosition", "asc"),
    ).execute()
  }

  async function getRawById(id: string): Promise<RawPostRow | undefined> {
    return await db
      .selectFrom("post")
      .where("post.id", "=", id)
      .select(POST_COLUMNS)
      .executeTakeFirst()
  }

  async function getOne<T extends (keyof DB["post"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["post"]>, T[number]> | undefined> {
    return await db.selectFrom("post").select(fields).where("id", "=", id).executeTakeFirst()
  }

  async function getManyByIds<T extends (keyof DB["post"])[]>(
    ids: string[],
    fields: T,
  ): Promise<Pick<Selectable<DB["post"]>, T[number]>[]> {
    if (ids.length === 0) return []
    return await db.selectFrom("post").select(fields).where("id", "in", ids).execute()
  }

  async function moderationQueue(opts: {
    communityIds: string[]
    tab: ModQueueTab
    limit: number
  }): Promise<ModPostRow[]> {
    if (opts.communityIds.length === 0) return []
    let query = db
      .selectFrom("post")
      .where("post.communityId", "in", opts.communityIds)
      .select(MOD_POST_COLUMNS)
    if (opts.tab === "needs_review") {
      query = query.where((eb) =>
        eb.or([
          hasPendingReport(eb),
          eb.and([eb("post.removedAt", "is not", null), eb("post.removedByUserId", "is", null)]),
        ]),
      )
    } else if (opts.tab === "reported") {
      query = query.where("post.removedAt", "is", null).where((eb) => hasPendingReport(eb))
    } else if (opts.tab === "removed") {
      query = query
        .where("post.removedAt", "is not", null)
        .where("post.removedByUserId", "is not", null)
    } else if (opts.tab === "edited") {
      query = query.where("post.removedAt", "is", null).where("post.editedAt", "is not", null)
    } else {
      query = query
        .where("post.removedAt", "is", null)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("modAction")
                .select("modAction.id")
                .whereRef("modAction.targetPostId", "=", "post.id"),
            ),
          ),
        )
    }
    return await query
      .orderBy("post.createdAt", "desc")
      .orderBy("post.id", "desc")
      .limit(opts.limit)
      .execute()
  }

  return {
    communityFeed,
    multiCommunityFeed,
    globalFeed,
    homeFeed,
    savedPostsFeed,
    hiddenPostsFeed,
    votedPostsFeed,
    authoredPostsFeed,
    viewedPostsFeed,
    profileFeed,
    getStickyForCommunity,
    getRawById,
    getOne,
    getManyByIds,
    moderationQueue,
  }
}
