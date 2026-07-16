import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import { COMMENT_COLUMNS, type RawCommentRow } from "../comment/fetch"
import { POST_COLUMNS, type RawPostRow } from "../post/fetch"

// Merged, reverse-chronological stream of a user's authored posts and comments. Both sides
// are keyset-paginated over (createdAt desc, id desc); we over-fetch limit+1 from each table,
// merge, and slice so the page boundary is stable even when new rows arrive between pages.

export interface OverviewPostItem {
  kind: "post"
  createdAt: Date
  id: string
  post: RawPostRow
}

export interface OverviewCommentItem {
  kind: "comment"
  createdAt: Date
  id: string
  comment: RawCommentRow
}

export type OverviewRawItem = OverviewPostItem | OverviewCommentItem

export function fetchUserOverview(db: Kysely<DB>) {
  async function getPage(opts: {
    authorUserId: string
    cursorCreatedAt: Date | null
    cursorId: string | null
    limit: number
  }): Promise<{ items: OverviewRawItem[]; hasMore: boolean }> {
    const { authorUserId, cursorCreatedAt, cursorId, limit } = opts
    const hasCursor = cursorCreatedAt !== null && cursorId !== null
    const fetchLimit = limit + 1

    const posts = await db
      .selectFrom("post")
      .where("post.authorUserId", "=", authorUserId)
      .where("post.removedAt", "is", null)
      .$if(hasCursor, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("post.createdAt", "<", cursorCreatedAt!),
            eb.and([eb("post.createdAt", "=", cursorCreatedAt!), eb("post.id", "<", cursorId!)]),
          ]),
        ),
      )
      .select(POST_COLUMNS)
      .orderBy("post.createdAt", "desc")
      .orderBy("post.id", "desc")
      .limit(fetchLimit)
      .execute()

    const comments = await db
      .selectFrom("comment")
      .where("comment.authorUserId", "=", authorUserId)
      .where("comment.isDeleted", "=", false)
      .where("comment.removedAt", "is", null)
      .$if(hasCursor, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("comment.createdAt", "<", cursorCreatedAt!),
            eb.and([
              eb("comment.createdAt", "=", cursorCreatedAt!),
              eb("comment.id", "<", cursorId!),
            ]),
          ]),
        ),
      )
      .select(COMMENT_COLUMNS)
      .orderBy("comment.createdAt", "desc")
      .orderBy("comment.id", "desc")
      .limit(fetchLimit)
      .execute()

    const merged: OverviewRawItem[] = [
      ...posts.map((p) => ({ kind: "post" as const, createdAt: p.createdAt, id: p.id, post: p })),
      ...comments.map((cm) => ({
        kind: "comment" as const,
        createdAt: cm.createdAt,
        id: cm.id,
        comment: cm,
      })),
    ]
    merged.sort((a, b) => {
      const diff = b.createdAt.getTime() - a.createdAt.getTime()
      if (diff !== 0) return diff
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
    })

    const hasMore = merged.length > limit
    return { items: merged.slice(0, limit), hasMore }
  }

  return { getPage }
}
