import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchPostFollow(db: Kysely<DB>) {
  async function isFollowing(postId: string, userId: string): Promise<boolean> {
    const row = await db
      .selectFrom("postFollow")
      .select("postId")
      .where("postId", "=", postId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return row !== undefined
  }

  return { isFollowing }
}
