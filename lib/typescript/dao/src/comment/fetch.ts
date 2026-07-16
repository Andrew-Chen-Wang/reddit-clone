import type { DB } from "@template-nextjs/db"
import {
  type ExpressionBuilder,
  type ExpressionWrapper,
  type Kysely,
  type Selectable,
  type SelectQueryBuilder,
  sql,
  type SqlBool,
} from "kysely"
import type { ModQueueTab } from "../post/fetch"

export type CommentSort = "best" | "top" | "new" | "old" | "controversial"

export const ROOT_PAGE_SIZE = 100
export const CHILD_PAGE_SIZE = 25
export const MAX_DEPTH = 10
export const INITIAL_CHILDREN = 10
export const DESC_FETCH_CAP = 800
export const NODE_BUDGET = 300

export type RawCommentRow = {
  id: string
  postId: string
  parentCommentId: string | null
  path: string[]
  depth: number
  authorUserId: string | null
  bodyMd: string | null
  ups: number
  downs: number
  score: number
  wilsonScore: string
  controversialScore: number
  childCount: number
  isSticky: boolean
  isDeleted: boolean
  createdAt: Date
  editedAt: Date | null
  removedAt: Date | null
}

export const COMMENT_COLUMNS = [
  "comment.id",
  "comment.postId",
  "comment.parentCommentId",
  "comment.path",
  "comment.depth",
  "comment.authorUserId",
  "comment.bodyMd",
  "comment.ups",
  "comment.downs",
  "comment.score",
  "comment.wilsonScore",
  "comment.controversialScore",
  "comment.childCount",
  "comment.isSticky",
  "comment.isDeleted",
  "comment.createdAt",
  "comment.editedAt",
  "comment.removedAt",
] as const

const MOD_COMMENT_COLUMNS = [
  ...COMMENT_COLUMNS,
  "comment.removedByUserId",
  "comment.removalReasonId",
  "comment.isSpam",
  "comment.approvedAt",
] as const

export type ModCommentRow = RawCommentRow & {
  removedByUserId: string | null
  removalReasonId: string | null
  isSpam: boolean
  approvedAt: Date | null
  postCommunityId: string | null
}

// biome-ignore lint/suspicious/noExplicitAny: query builder unions across sort branches
type CommentQuery = SelectQueryBuilder<DB, any, RawCommentRow>

function compareIds(a: string, b: string, dir: "asc" | "desc"): number {
  const cmp = a < b ? -1 : a > b ? 1 : 0
  return dir === "asc" ? cmp : -cmp
}

export function commentComparator(
  sort: CommentSort,
): (a: RawCommentRow, b: RawCommentRow) => number {
  return (a, b) => {
    if (a.isSticky !== b.isSticky) return a.isSticky ? -1 : 1
    if (sort === "best") {
      const aw = BigInt(a.wilsonScore)
      const bw = BigInt(b.wilsonScore)
      if (aw !== bw) return aw > bw ? -1 : 1
      return compareIds(a.id, b.id, "desc")
    }
    if (sort === "top") {
      if (a.score !== b.score) return b.score - a.score
      return compareIds(a.id, b.id, "desc")
    }
    if (sort === "new") {
      const diff = b.createdAt.getTime() - a.createdAt.getTime()
      if (diff !== 0) return diff
      return compareIds(a.id, b.id, "desc")
    }
    if (sort === "old") {
      const diff = a.createdAt.getTime() - b.createdAt.getTime()
      if (diff !== 0) return diff
      return compareIds(a.id, b.id, "asc")
    }
    if (a.controversialScore !== b.controversialScore) {
      return b.controversialScore - a.controversialScore
    }
    return compareIds(a.id, b.id, "desc")
  }
}

function applySort(query: CommentQuery, sort: CommentSort): CommentQuery {
  const base = query.orderBy("comment.isSticky", "desc")
  if (sort === "best") {
    return base.orderBy("comment.wilsonScore", "desc").orderBy("comment.id", "desc")
  }
  if (sort === "top") {
    return base.orderBy("comment.score", "desc").orderBy("comment.id", "desc")
  }
  if (sort === "new") {
    return base.orderBy("comment.createdAt", "desc").orderBy("comment.id", "desc")
  }
  if (sort === "old") {
    return base.orderBy("comment.createdAt", "asc").orderBy("comment.id", "asc")
  }
  return base.orderBy("comment.controversialScore", "desc").orderBy("comment.id", "desc")
}

function assemble(
  pageChildren: RawCommentRow[],
  descendants: RawCommentRow[],
  baseDepth: number,
  maxDepth: number,
  sort: CommentSort,
): RawCommentRow[] {
  const cmp = commentComparator(sort)
  const childrenByParent = new Map<string, RawCommentRow[]>()
  for (const row of descendants) {
    if (row.parentCommentId === null) continue
    const list = childrenByParent.get(row.parentCommentId) ?? []
    list.push(row)
    childrenByParent.set(row.parentCommentId, list)
  }
  for (const [key, list] of childrenByParent) childrenByParent.set(key, list.toSorted(cmp))

  const result: RawCommentRow[] = []
  const maxAbsDepth = baseDepth + maxDepth
  const visit = (node: RawCommentRow): void => {
    result.push(node)
    if (result.length >= NODE_BUDGET) return
    if (node.depth >= maxAbsDepth) return
    const kids = childrenByParent.get(node.id) ?? []
    for (const kid of kids.slice(0, INITIAL_CHILDREN)) {
      if (result.length >= NODE_BUDGET) break
      visit(kid)
    }
  }
  for (const root of pageChildren.toSorted(cmp)) {
    if (result.length >= NODE_BUDGET) break
    visit(root)
  }
  return result
}

function hasPendingReport(
  eb: ExpressionBuilder<DB, "comment" | "post">,
): ExpressionWrapper<DB, "comment" | "post", SqlBool> {
  return eb.exists(
    eb
      .selectFrom("commentReport")
      .select("commentReport.id")
      .whereRef("commentReport.commentId", "=", "comment.id")
      .where("commentReport.status", "=", "pending"),
  )
}

export function fetchComment(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["comment"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["comment"]>, T[number]> | undefined> {
    return await db.selectFrom("comment").select(fields).where("id", "=", id).executeTakeFirst()
  }

  async function getRawById(id: string): Promise<RawCommentRow | undefined> {
    return await db
      .selectFrom("comment")
      .select(COMMENT_COLUMNS)
      .where("comment.id", "=", id)
      .executeTakeFirst()
  }

  async function countRecentByAuthor(authorUserId: string, since: Date): Promise<number> {
    const row = await db
      .selectFrom("comment")
      .where("authorUserId", "=", authorUserId)
      .where("createdAt", ">", since)
      .select((eb) => eb.fn.count<string>("id").as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  function authorCommentsQuery(authorUserId: string): CommentQuery {
    return db
      .selectFrom("comment")
      .where("comment.authorUserId", "=", authorUserId)
      .where("comment.isDeleted", "=", false)
      .where("comment.removedAt", "is", null)
      .select(COMMENT_COLUMNS)
      .orderBy("comment.createdAt", "desc")
      .orderBy("comment.id", "desc")
  }

  function savedCommentsQuery(userId: string): CommentQuery {
    return db
      .selectFrom("comment")
      .innerJoin("commentSave", "commentSave.commentId", "comment.id")
      .where("commentSave.userId", "=", userId)
      .where("comment.isDeleted", "=", false)
      .where("comment.removedAt", "is", null)
      .select(COMMENT_COLUMNS)
      .orderBy("commentSave.createdAt", "desc")
      .orderBy("comment.id", "desc")
  }

  function childrenQuery(
    postId: string,
    parentCommentId: string | null,
    sort: CommentSort,
  ): CommentQuery {
    const base = db
      .selectFrom("comment")
      .where("comment.postId", "=", postId)
      .$if(parentCommentId === null, (qb) => qb.where("comment.parentCommentId", "is", null))
      // biome-ignore lint/style/noNonNullAssertion: guarded by the $if predicate above
      .$if(parentCommentId !== null, (qb) =>
        qb.where("comment.parentCommentId", "=", parentCommentId!),
      )
      .select(COMMENT_COLUMNS)
    return applySort(base, sort)
  }

  function descendantsQuery(
    postId: string,
    ancestorIds: string[],
    excludeIds: string[],
    baseDepth: number,
    maxDepth: number,
    sort: CommentSort,
  ): CommentQuery {
    const base = db
      .selectFrom("comment")
      .where("comment.postId", "=", postId)
      .where(sql<boolean>`${sql.ref("comment.path")} && ${sql.val(ancestorIds)}::uuid[]`)
      .where("comment.depth", ">", baseDepth)
      .where("comment.depth", "<=", baseDepth + maxDepth)
      .$if(excludeIds.length > 0, (qb) => qb.where("comment.id", "not in", excludeIds))
      .select(COMMENT_COLUMNS)
    return applySort(base, sort)
  }

  async function collect(args: {
    postId: string
    pageParentId: string | null
    baseDepth: number
    sort: CommentSort
    offset: number
    pageSize: number
    maxDepth: number
  }): Promise<{ rows: RawCommentRow[]; hasMore: boolean }> {
    const { postId, pageParentId, baseDepth, sort, offset, pageSize, maxDepth } = args
    const fetched = await childrenQuery(postId, pageParentId, sort)
      .limit(pageSize + 1)
      .offset(offset)
      .execute()
    const hasMore = fetched.length > pageSize
    const pageChildren = hasMore ? fetched.slice(0, pageSize) : fetched
    if (pageChildren.length === 0) return { rows: [], hasMore: false }

    const pageChildIds = pageChildren.map((r) => r.id)
    const descendants = await descendantsQuery(
      postId,
      pageChildIds,
      pageChildIds,
      baseDepth,
      maxDepth,
      sort,
    )
      .limit(DESC_FETCH_CAP)
      .execute()
    return { rows: assemble(pageChildren, descendants, baseDepth, maxDepth, sort), hasMore }
  }

  async function getTreePage(args: {
    postId: string
    sort: CommentSort
    offset?: number
    pageSize?: number
    maxDepth?: number
  }): Promise<{ rows: RawCommentRow[]; hasMore: boolean }> {
    return await collect({
      postId: args.postId,
      pageParentId: null,
      baseDepth: 0,
      sort: args.sort,
      offset: args.offset ?? 0,
      pageSize: args.pageSize ?? ROOT_PAGE_SIZE,
      maxDepth: args.maxDepth ?? MAX_DEPTH,
    })
  }

  async function getChildrenPage(args: {
    postId: string
    parentId: string
    parentDepth: number
    sort: CommentSort
    offset?: number
    pageSize?: number
    maxDepth?: number
  }): Promise<{ rows: RawCommentRow[]; hasMore: boolean }> {
    return await collect({
      postId: args.postId,
      pageParentId: args.parentId,
      baseDepth: args.parentDepth + 1,
      sort: args.sort,
      offset: args.offset ?? 0,
      pageSize: args.pageSize ?? CHILD_PAGE_SIZE,
      maxDepth: args.maxDepth ?? MAX_DEPTH,
    })
  }

  async function getSubtreeWithAncestors(args: {
    commentId: string
    sort: CommentSort
    offset?: number
    pageSize?: number
    maxDepth?: number
  }): Promise<
    | { focus: RawCommentRow; rows: RawCommentRow[]; ancestors: RawCommentRow[]; hasMore: boolean }
    | undefined
  > {
    const focus = await getRawById(args.commentId)
    if (!focus) return undefined
    const { rows, hasMore } = await collect({
      postId: focus.postId,
      pageParentId: focus.id,
      baseDepth: focus.depth + 1,
      sort: args.sort,
      offset: args.offset ?? 0,
      pageSize: args.pageSize ?? CHILD_PAGE_SIZE,
      maxDepth: args.maxDepth ?? MAX_DEPTH,
    })
    const ancestorIds = focus.path.filter((id) => id !== focus.id)
    let ancestors: RawCommentRow[] = []
    if (ancestorIds.length > 0) {
      ancestors = await db
        .selectFrom("comment")
        .select(COMMENT_COLUMNS)
        .where("comment.id", "in", ancestorIds)
        .orderBy("comment.depth", "asc")
        .execute()
    }
    return { focus, rows, ancestors, hasMore }
  }

  async function moderationQueue(opts: {
    communityIds: string[]
    tab: ModQueueTab
    limit: number
  }): Promise<ModCommentRow[]> {
    if (opts.communityIds.length === 0) return []
    let query = db
      .selectFrom("comment")
      .innerJoin("post", "post.id", "comment.postId")
      .where("post.communityId", "in", opts.communityIds)
      .where("comment.isDeleted", "=", false)
      .select(MOD_COMMENT_COLUMNS)
      .select("post.communityId as postCommunityId")
    if (opts.tab === "needs_review") {
      query = query.where((eb) =>
        eb.or([
          hasPendingReport(eb),
          eb.and([
            eb("comment.removedAt", "is not", null),
            eb("comment.removedByUserId", "is", null),
          ]),
        ]),
      )
    } else if (opts.tab === "reported") {
      query = query.where("comment.removedAt", "is", null).where((eb) => hasPendingReport(eb))
    } else if (opts.tab === "removed") {
      query = query
        .where("comment.removedAt", "is not", null)
        .where("comment.removedByUserId", "is not", null)
    } else if (opts.tab === "edited") {
      query = query.where("comment.removedAt", "is", null).where("comment.editedAt", "is not", null)
    } else {
      query = query
        .where("comment.removedAt", "is", null)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("modAction")
                .select("modAction.id")
                .whereRef("modAction.targetCommentId", "=", "comment.id"),
            ),
          ),
        )
    }
    return await query
      .orderBy("comment.createdAt", "desc")
      .orderBy("comment.id", "desc")
      .limit(opts.limit)
      .execute()
  }

  return {
    getOne,
    getRawById,
    countRecentByAuthor,
    authorCommentsQuery,
    savedCommentsQuery,
    getTreePage,
    getChildrenPage,
    getSubtreeWithAncestors,
    moderationQueue,
  }
}
