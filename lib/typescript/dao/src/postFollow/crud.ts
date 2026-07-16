import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function crudPostFollow(db: Kysely<DB>) {
  async function follow(postId: string, userId: string): Promise<void> {
    await db
      .insertInto("postFollow")
      .values({ postId, userId })
      .onConflict((oc) => oc.columns(["userId", "postId"]).doNothing())
      .execute()
  }

  async function unfollow(postId: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("postFollow")
      .where("postId", "=", postId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { follow, unfollow }
}
