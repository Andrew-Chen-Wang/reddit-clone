import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchPostSave(db: Kysely<DB>) {
  async function isSaved(postId: string, userId: string): Promise<boolean> {
    const row = await db
      .selectFrom("postSave")
      .select("postId")
      .where("postId", "=", postId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return row !== undefined
  }

  return { isSaved }
}
