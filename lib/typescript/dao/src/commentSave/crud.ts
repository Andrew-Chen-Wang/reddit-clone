import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function crudCommentSave(db: Kysely<DB>) {
  async function save(commentId: string, userId: string): Promise<void> {
    await db
      .insertInto("commentSave")
      .values({ commentId, userId })
      .onConflict((oc) => oc.columns(["userId", "commentId"]).doNothing())
      .execute()
  }

  async function unsave(commentId: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("commentSave")
      .where("commentId", "=", commentId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { save, unsave }
}
