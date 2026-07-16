import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchCommentFollow(db: Kysely<DB>) {
  async function isFollowing(commentId: string, userId: string): Promise<boolean> {
    const row = await db
      .selectFrom("commentFollow")
      .select("commentId")
      .where("commentId", "=", commentId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return row !== undefined
  }

  async function listFollowerIds(commentId: string): Promise<string[]> {
    const rows = await db
      .selectFrom("commentFollow")
      .select("userId")
      .where("commentId", "=", commentId)
      .execute()
    return rows.map((r) => r.userId)
  }

  return { isFollowing, listFollowerIds }
}
