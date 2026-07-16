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

  return { isFollowing }
}
