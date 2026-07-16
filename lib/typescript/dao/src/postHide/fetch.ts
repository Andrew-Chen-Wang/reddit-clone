import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchPostHide(db: Kysely<DB>) {
  async function isHidden(postId: string, userId: string): Promise<boolean> {
    const row = await db
      .selectFrom("postHide")
      .select("postId")
      .where("postId", "=", postId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return row !== undefined
  }

  return { isHidden }
}
