import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export interface AdminUserRow {
  id: string
  username: string
  email: string
  postKarma: number
  commentKarma: number
  createdAt: Date
  suspendedAt: Date | null
  suspensionReason: string | null
}

export interface AdminPostRow {
  id: string
  title: string
  communityId: string | null
  communityName: string | null
  authorUsername: string | null
  score: number
  removedAt: Date | null
  createdAt: Date
}

export interface AdminCounts {
  users: number
  posts: number
  communities: number
  comments: number
  reportsPending: number
}

export function fetchAdmin(db: Kysely<DB>) {
  async function searchUsers(
    q: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<AdminUserRow[]> {
    let query = db
      .selectFrom("user")
      .select([
        "id",
        "username",
        "email",
        "postKarma",
        "commentKarma",
        "createdAt",
        "suspendedAt",
        "suspensionReason",
      ])
      .orderBy("id", "desc")
      .limit(limit)
    if (q) {
      const pattern = `%${q}%`
      query = query.where((eb) =>
        eb.or([eb("username", "ilike", pattern), eb("email", "ilike", pattern)]),
      )
    }
    if (cursor) query = query.where("id", "<", cursor)
    return await query.execute()
  }

  async function searchPosts(
    q: string | null,
    cursor: string | null,
    limit: number,
  ): Promise<AdminPostRow[]> {
    let query = db
      .selectFrom("post")
      .leftJoin("community", "community.id", "post.communityId")
      .leftJoin("user", "user.id", "post.authorUserId")
      .select([
        "post.id as id",
        "post.title as title",
        "post.communityId as communityId",
        "community.name as communityName",
        "user.username as authorUsername",
        "post.score as score",
        "post.removedAt as removedAt",
        "post.createdAt as createdAt",
      ])
      .orderBy("post.id", "desc")
      .limit(limit)
    if (q) query = query.where("post.title", "ilike", `%${q}%`)
    if (cursor) query = query.where("post.id", "<", cursor)
    return await query.execute()
  }

  async function counts(): Promise<AdminCounts> {
    const countOf = async (table: "user" | "post" | "community" | "comment"): Promise<number> => {
      const row = await db
        .selectFrom(table)
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .executeTakeFirst()
      return row ? Number(row.count) : 0
    }

    const pendingPostReports = await db
      .selectFrom("postReport")
      .where("status", "=", "pending")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirst()
    const pendingCommentReports = await db
      .selectFrom("commentReport")
      .where("status", "=", "pending")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirst()

    const [users, posts, communities, comments] = await Promise.all([
      countOf("user"),
      countOf("post"),
      countOf("community"),
      countOf("comment"),
    ])

    return {
      users,
      posts,
      communities,
      comments,
      reportsPending:
        (pendingPostReports ? Number(pendingPostReports.count) : 0) +
        (pendingCommentReports ? Number(pendingCommentReports.count) : 0),
    }
  }

  return { searchUsers, searchPosts, counts }
}
