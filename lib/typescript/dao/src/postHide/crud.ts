import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function crudPostHide(db: Kysely<DB>) {
  async function hide(postId: string, userId: string): Promise<void> {
    await db
      .insertInto("postHide")
      .values({ postId, userId })
      .onConflict((oc) => oc.columns(["userId", "postId"]).doNothing())
      .execute()
  }

  async function unhide(postId: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("postHide")
      .where("postId", "=", postId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { hide, unhide }
}
