import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function crudPostSave(db: Kysely<DB>) {
  async function save(postId: string, userId: string): Promise<void> {
    await db
      .insertInto("postSave")
      .values({ postId, userId })
      .onConflict((oc) => oc.columns(["userId", "postId"]).doNothing())
      .execute()
  }

  async function unsave(postId: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("postSave")
      .where("postId", "=", postId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { save, unsave }
}
