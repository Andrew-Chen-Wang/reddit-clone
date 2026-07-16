import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function crudUserFollow(db: Kysely<DB>) {
  async function follow(followerUserId: string, followedUserId: string): Promise<void> {
    await db
      .insertInto("userFollow")
      .values({ followerUserId, followedUserId })
      .onConflict((oc) => oc.columns(["followerUserId", "followedUserId"]).doNothing())
      .execute()
  }

  async function unfollow(followerUserId: string, followedUserId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("userFollow")
      .where("followerUserId", "=", followerUserId)
      .where("followedUserId", "=", followedUserId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { follow, unfollow }
}
