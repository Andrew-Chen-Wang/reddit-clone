import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function crudCommentFollow(db: Kysely<DB>) {
  async function follow(commentId: string, userId: string): Promise<void> {
    await db
      .insertInto("commentFollow")
      .values({ commentId, userId })
      .onConflict((oc) => oc.columns(["userId", "commentId"]).doNothing())
      .execute()
  }

  async function unfollow(commentId: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("commentFollow")
      .where("commentId", "=", commentId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { follow, unfollow }
}
