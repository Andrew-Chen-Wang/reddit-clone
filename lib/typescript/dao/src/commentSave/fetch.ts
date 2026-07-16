import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchCommentSave(db: Kysely<DB>) {
  async function isSaved(commentId: string, userId: string): Promise<boolean> {
    const row = await db
      .selectFrom("commentSave")
      .select("commentId")
      .where("commentId", "=", commentId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return row !== undefined
  }

  return { isSaved }
}
